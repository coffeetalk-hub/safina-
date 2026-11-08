import { z } from "zod";
import { prisma } from "@/lib/prisma";
import type { AppSession } from "@/core/auth/session";

export const currencySchema = z.object({
  code: z.string().trim().length(3).toUpperCase(),
  nameAr: z.string().trim().min(1).max(60),
  nameEn: z.string().trim().min(1).max(60),
  symbol: z.string().trim().max(5).nullable().optional(),
  decimals: z.coerce.number().int().min(0).max(4).default(2),
});

export const rateSchema = z.object({
  currencyCode: z.string().trim().length(3),
  rateDate: z.string().min(10),
  rate: z.coerce.number().positive(),
});

export async function listCurrencies(session: AppSession) {
  const rows = await prisma.companyCurrency.findMany({ where: { companyId: session.companyId }, include: { currency: true }, orderBy: { currencyCode: "asc" } });
  const latest = await prisma.exchangeRate.findMany({ where: { companyId: session.companyId }, orderBy: { rateDate: "desc" }, distinct: ["currencyCode"] });
  return rows.map((r) => ({ ...r.currency, isActive: r.isActive, latestRate: latest.find((l) => l.currencyCode === r.currencyCode) ?? null }));
}

export async function listRates(session: AppSession, currencyCode?: string) {
  return prisma.exchangeRate.findMany({ where: { companyId: session.companyId, currencyCode: currencyCode || undefined }, orderBy: [{ rateDate: "desc" }, { currencyCode: "asc" }], take: 200 });
}

export async function enableCurrency(session: AppSession, input: z.infer<typeof currencySchema>) {
  await prisma.currency.upsert({ where: { code: input.code }, create: input, update: { nameAr: input.nameAr, nameEn: input.nameEn, symbol: input.symbol, decimals: input.decimals } });
  return prisma.companyCurrency.upsert({
    where: { companyId_currencyCode: { companyId: session.companyId, currencyCode: input.code } },
    create: { companyId: session.companyId, currencyCode: input.code },
    update: { isActive: true },
  });
}

export async function toggleCurrency(session: AppSession, code: string, isActive: boolean) {
  const c = await prisma.company.findUnique({ where: { id: session.companyId } });
  if (c?.baseCurrency === code) throw new Error("BASE_CURRENCY");
  return prisma.companyCurrency.update({ where: { companyId_currencyCode: { companyId: session.companyId, currencyCode: code } }, data: { isActive } });
}

export async function addRate(session: AppSession, input: z.infer<typeof rateSchema>) {
  return prisma.exchangeRate.upsert({
    where: { companyId_currencyCode_rateDate: { companyId: session.companyId, currencyCode: input.currencyCode, rateDate: new Date(input.rateDate) } },
    create: { companyId: session.companyId, currencyCode: input.currencyCode, rateDate: new Date(input.rateDate), rate: input.rate, createdById: session.userId },
    update: { rate: input.rate },
  });
}

/** Latest rate on or before date; base currency = 1. */
export async function getRate(companyId: string, currencyCode: string, date: Date, baseCurrency = "SAR") {
  if (currencyCode === baseCurrency) return 1;
  const r = await prisma.exchangeRate.findFirst({ where: { companyId, currencyCode, rateDate: { lte: date } }, orderBy: { rateDate: "desc" } });
  if (!r) throw new Error("NO_EXCHANGE_RATE");
  return Number(r.rate);
}
