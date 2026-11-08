import { z } from "zod";
import { prisma } from "@/lib/prisma";
import type { AppSession } from "@/core/auth/session";
import { zStr } from "@/modules/foundation/_shared/crud";

export const priceListSchema = z.object({
  id: z.string().nullable().optional(),
  code: zStr(20), nameAr: zStr(), nameEn: zStr(),
  currencyCode: z.string().length(3).default("SAR"),
  isDefault: z.coerce.boolean().default(false), isActive: z.coerce.boolean().default(true),
  validFrom: z.string().nullable().optional(), validTo: z.string().nullable().optional(),
  items: z.array(z.object({ itemId: z.string().min(1), price: z.coerce.number().min(0), minQty: z.coerce.number().min(0).default(0) })).default([]),
});
export async function listPriceLists(session: AppSession) {
  return prisma.priceList.findMany({ where: { companyId: session.companyId }, orderBy: { code: "asc" }, include: { items: { include: { item: { select: { code: true, nameAr: true, nameEn: true, salePrice: true } } } }, _count: { select: { items: true } } } });
}
export async function savePriceList(session: AppSession, input: z.infer<typeof priceListSchema>) {
  const { id, items, ...rest } = input;
  const seen = new Set<string>();
  const its = items.filter((i) => { const k = `${i.itemId}|${i.minQty}`; if (seen.has(k)) return false; seen.add(k); return true; });
  const data = { ...rest, validFrom: rest.validFrom ? new Date(rest.validFrom) : null, validTo: rest.validTo ? new Date(rest.validTo) : null };
  return prisma.$transaction(async (tx) => {
    if (data.isDefault) await tx.priceList.updateMany({ where: { companyId: session.companyId, id: id ? { not: id } : undefined }, data: { isDefault: false } });
    if (id) {
      const ex = await tx.priceList.findFirst({ where: { id, companyId: session.companyId } });
      if (!ex) throw new Error("NOT_FOUND");
      await tx.priceListItem.deleteMany({ where: { priceListId: id } });
      return tx.priceList.update({ where: { id }, data: { ...data, items: { create: its } } });
    }
    return tx.priceList.create({ data: { ...data, companyId: session.companyId, items: { create: its } } });
  });
}
export async function deletePriceList(session: AppSession, id: string) {
  const ex = await prisma.priceList.findFirst({ where: { id, companyId: session.companyId } });
  if (!ex) throw new Error("NOT_FOUND");
  await prisma.customer.updateMany({ where: { companyId: session.companyId, priceListId: id }, data: { priceListId: null } });
  return prisma.priceList.delete({ where: { id } });
}
export const customerPriceSchema = z.object({ customerId: z.string().min(1), priceListId: z.string().nullable().optional(), prices: z.array(z.object({ itemId: z.string().min(1), price: z.coerce.number().min(0), discountPct: z.coerce.number().min(0).max(100).default(0) })).default([]) });
export async function customerPricing(session: AppSession, customerId: string) {
  const c = await prisma.customer.findFirst({ where: { id: customerId, companyId: session.companyId }, select: { id: true, priceListId: true, itemPrices: { include: { item: { select: { code: true, nameAr: true, nameEn: true } } } } } });
  if (!c) throw new Error("NOT_FOUND");
  return c;
}
export async function saveCustomerPricing(session: AppSession, input: z.infer<typeof customerPriceSchema>) {
  const c = await prisma.customer.findFirst({ where: { id: input.customerId, companyId: session.companyId } });
  if (!c) throw new Error("NOT_FOUND");
  const seen = new Set<string>();
  const prices = input.prices.filter((p) => { if (seen.has(p.itemId)) return false; seen.add(p.itemId); return true; });
  return prisma.$transaction(async (tx) => {
    await tx.customer.update({ where: { id: c.id }, data: { priceListId: input.priceListId || null } });
    await tx.customerItemPrice.deleteMany({ where: { customerId: c.id } });
    if (prices.length) await tx.customerItemPrice.createMany({ data: prices.map((p) => ({ companyId: session.companyId, customerId: c.id, ...p })) });
    return true;
  });
}
