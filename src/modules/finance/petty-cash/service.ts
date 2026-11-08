import { z } from "zod";
import { prisma } from "@/lib/prisma";
import type { AppSession } from "@/core/auth/session";
import { orderByFrom, skipTake, type ColumnDef, type ListParams, type PagedResult } from "@/components/data-table/types";
import { makeCrud, zStr } from "@/modules/foundation/_shared/crud";
import { nextDocumentNumber } from "@/core/numbering";
import { postJournal, reverseJournal, mappedAccount, accountNetBalance, type PostingLine } from "@/core/posting";
import { D, round } from "@/lib/money";

export const fundSchema = z.object({
  id: z.string().nullable().optional(),
  code: zStr(20),
  nameAr: zStr(),
  nameEn: zStr(),
  branchId: z.string().nullable().optional(),
  custodianEmployeeId: z.string().nullable().optional(),
  accountId: z.string().min(1),
  floatAmount: z.coerce.number().min(0).default(0),
  isActive: z.coerce.boolean().default(true),
});

export const funds = makeCrud({ model: "pettyCashFund", resource: "pettyCash", schema: fundSchema, searchFields: ["code", "nameAr", "nameEn"], sortFields: ["code", "nameEn"], defaultOrder: { code: "asc" } });

export async function fundsWithBalances(session: AppSession) {
  const rows = await prisma.pettyCashFund.findMany({ where: { companyId: session.companyId }, orderBy: { code: "asc" } });
  const employees = await prisma.employee.findMany({ where: { id: { in: rows.map((r) => r.custodianEmployeeId).filter(Boolean) as string[] } }, select: { id: true, firstNameAr: true, lastNameAr: true, firstNameEn: true, lastNameEn: true } });
  const accounts = await prisma.account.findMany({ where: { id: { in: rows.map((r) => r.accountId) } }, select: { id: true, code: true } });
  return Promise.all(rows.map(async (r) => {
    const e = employees.find((x) => x.id === r.custodianEmployeeId);
    return { ...r, balance: (await accountNetBalance(session.companyId, r.accountId)).toNumber(), accountCode: accounts.find((a) => a.id === r.accountId)?.code ?? "", custodianAr: e ? `${e.firstNameAr} ${e.lastNameAr}` : "", custodianEn: e ? `${e.firstNameEn} ${e.lastNameEn}` : "" };
  }));
}

export const voucherSchema = z.object({
  id: z.string().nullable().optional(),
  fundId: z.string().min(1),
  voucherDate: z.string().min(10),
  type: z.enum(["EXPENSE", "REPLENISHMENT"]).default("EXPENSE"),
  description: z.string().min(1).max(500),
  amount: z.coerce.number().positive(),
  taxCodeId: z.string().nullable().optional(),
  expenseAccountId: z.string().nullable().optional(),
  costCenterId: z.string().nullable().optional(),
  bankAccountId: z.string().nullable().optional(),
  vendorName: z.string().max(200).nullable().optional(),
});
export type VoucherInput = z.infer<typeof voucherSchema>;

function where(session: AppSession, p: ListParams) {
  const w: Record<string, unknown> = { companyId: session.companyId };
  if (p.q) w.OR = [{ number: { contains: p.q, mode: "insensitive" } }, { description: { contains: p.q, mode: "insensitive" } }, { vendorName: { contains: p.q, mode: "insensitive" } }];
  if (p.filters.fundId) w.fundId = p.filters.fundId;
  if (p.filters.status) w.status = p.filters.status;
  if (p.filters.type) w.type = p.filters.type;
  if (p.filters.from || p.filters.to) w.voucherDate = { gte: p.filters.from ? new Date(p.filters.from) : undefined, lte: p.filters.to ? new Date(p.filters.to) : undefined };
  return w;
}
const include = { fund: { select: { code: true, nameAr: true, nameEn: true } } };

export async function listVouchers(session: AppSession, p: ListParams): Promise<PagedResult<Record<string, unknown>>> {
  const w = where(session, p);
  const [rows, total] = await Promise.all([prisma.pettyCashVoucher.findMany({ where: w, orderBy: orderByFrom(p.sort, ["number", "voucherDate", "amount", "status"], { voucherDate: "desc" }), ...skipTake(p), include }), prisma.pettyCashVoucher.count({ where: w })]);
  return { rows, total, page: p.page, pageSize: p.pageSize };
}
export async function allVouchers(session: AppSession, p: ListParams) {
  return prisma.pettyCashVoucher.findMany({ where: where(session, p), orderBy: { voucherDate: "desc" }, take: 10_000, include });
}

export async function saveVoucher(session: AppSession, input: VoucherInput) {
  const fund = await prisma.pettyCashFund.findFirst({ where: { id: input.fundId, companyId: session.companyId } });
  if (!fund) throw new Error("NOT_FOUND");
  let taxAmount = D(0);
  if (input.type === "EXPENSE" && input.taxCodeId) {
    const tc = await prisma.taxCode.findFirst({ where: { id: input.taxCodeId, companyId: session.companyId } });
    if (tc) taxAmount = round(D(input.amount).times(tc.rate).div(100), 2);
  }
  if (input.type === "EXPENSE" && !input.expenseAccountId) throw new Error("EXPENSE_ACCOUNT_REQUIRED");
  const data = { fundId: input.fundId, voucherDate: new Date(input.voucherDate), type: input.type, description: input.description, amount: input.amount, taxCodeId: input.type === "EXPENSE" ? input.taxCodeId || null : null, taxAmount, expenseAccountId: input.type === "EXPENSE" ? input.expenseAccountId || null : null, costCenterId: input.costCenterId || null, bankAccountId: input.type === "REPLENISHMENT" ? input.bankAccountId || null : null, vendorName: input.vendorName ?? null };
  return prisma.$transaction(async (tx) => {
    if (input.id) {
      const ex = await tx.pettyCashVoucher.findFirst({ where: { id: input.id, companyId: session.companyId } });
      if (!ex) throw new Error("NOT_FOUND");
      if (ex.status !== "DRAFT") throw new Error("NOT_DRAFT");
      return tx.pettyCashVoucher.update({ where: { id: input.id }, data });
    }
    const number = await nextDocumentNumber(tx, session.companyId, "PETTY_CASH", data.voucherDate);
    return tx.pettyCashVoucher.create({ data: { ...data, companyId: session.companyId, number, status: "DRAFT", createdById: session.userId } });
  });
}

export async function postVoucher(session: AppSession, id: string) {
  return prisma.$transaction(async (tx) => {
    const v = await tx.pettyCashVoucher.findFirst({ where: { id, companyId: session.companyId }, include: { fund: true } });
    if (!v) throw new Error("NOT_FOUND");
    if (v.status !== "DRAFT") throw new Error("NOT_DRAFT");
    const lines: PostingLine[] = [];
    if (v.type === "EXPENSE") {
      lines.push({ accountId: v.expenseAccountId!, costCenterId: v.costCenterId, description: v.description, debit: v.amount, ...(D(v.taxAmount).isZero() && v.taxCodeId ? { taxCodeId: v.taxCodeId, taxBase: v.amount } : {}) });
      if (!D(v.taxAmount).isZero()) lines.push({ accountId: await mappedAccount(tx, session.companyId, "VAT_INPUT"), costCenterId: v.costCenterId, description: "VAT", debit: v.taxAmount, taxCodeId: v.taxCodeId, taxBase: v.amount });
      lines.push({ accountId: v.fund.accountId, credit: D(v.amount).plus(v.taxAmount), description: v.fund.nameEn });
    } else {
      const bank = v.bankAccountId ? await tx.bankAccount.findFirst({ where: { id: v.bankAccountId } }) : null;
      lines.push({ accountId: v.fund.accountId, debit: v.amount, description: `Replenish ${v.fund.nameEn}` });
      lines.push({ accountId: bank?.accountId ?? (await mappedAccount(tx, session.companyId, "BANK_DEFAULT")), credit: v.amount, description: v.description });
    }
    const entry = await postJournal(tx, { companyId: session.companyId, branchId: v.fund.branchId, entryDate: v.voucherDate, description: `Petty cash ${v.number} — ${v.description}`, reference: v.number, source: "PETTY_CASH", sourceType: "PettyCashVoucher", sourceId: v.id, lines, userId: session.userId });
    await tx.pettyCashVoucher.update({ where: { id }, data: { status: "POSTED", journalEntryId: entry.id } });
    return { status: "POSTED" as const };
  });
}

export async function reverseVoucher(session: AppSession, id: string) {
  return prisma.$transaction(async (tx) => {
    const v = await tx.pettyCashVoucher.findFirst({ where: { id, companyId: session.companyId } });
    if (!v || v.status !== "POSTED") throw new Error("NOT_POSTED");
    if (v.journalEntryId) await reverseJournal(tx, session.companyId, v.journalEntryId, session.userId);
    return tx.pettyCashVoucher.update({ where: { id }, data: { status: "REVERSED" } });
  });
}

export async function deleteVoucher(session: AppSession, id: string) {
  const v = await prisma.pettyCashVoucher.findFirst({ where: { id, companyId: session.companyId } });
  if (!v || v.status !== "DRAFT") throw new Error("NOT_DRAFT");
  return prisma.pettyCashVoucher.delete({ where: { id } });
}

export function voucherColumns(tf: (k: string) => string, t: (k: string) => string): ColumnDef[] {
  return [
    { key: "number", label: tf("number"), sortable: true },
    { key: "voucherDate", label: tf("date"), type: "date", sortable: true },
    { key: "fund", label: t("fund"), path: "fund.code" },
    { key: "type", label: tf("type"), type: "enum", enumName: "PettyCashType", tones: { EXPENSE: "warning", REPLENISHMENT: "success" } },
    { key: "description", label: tf("description") },
    { key: "vendorName", label: t("vendor"), hidden: true },
    { key: "amount", label: tf("amount"), type: "money", align: "end", sortable: true },
    { key: "taxAmount", label: t("vat"), type: "money", align: "end" },
    { key: "status", label: tf("status"), type: "enum", enumName: "DocStatus", tones: { DRAFT: "secondary", POSTED: "success", REVERSED: "destructive" } },
  ];
}
