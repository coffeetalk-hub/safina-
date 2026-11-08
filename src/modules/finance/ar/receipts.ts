import { z } from "zod";
import { prisma } from "@/lib/prisma";
import type { AppSession } from "@/core/auth/session";
import { orderByFrom, skipTake, type ColumnDef, type ListParams, type PagedResult } from "@/components/data-table/types";
import { nextDocumentNumber } from "@/core/numbering";
import { postJournal, reverseJournal, mappedAccount } from "@/core/posting";
import { D, round } from "@/lib/money";
import { docWhere, OPEN_STATUSES } from "../_shared/docs";

export const receiptSchema = z.object({
  id: z.string().nullable().optional(),
  customerId: z.string().min(1),
  branchId: z.string().nullable().optional(),
  receiptDate: z.string().min(10),
  method: z.enum(["CASH", "BANK_TRANSFER", "CHEQUE", "CARD", "OTHER"]).default("BANK_TRANSFER"),
  bankAccountId: z.string().nullable().optional(),
  currencyCode: z.string().length(3).default("SAR"),
  exchangeRate: z.coerce.number().positive().default(1),
  amount: z.coerce.number().positive(),
  reference: z.string().max(100).nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
  allocations: z.array(z.object({ invoiceId: z.string(), amount: z.coerce.number().min(0) })).default([]),
});
export type ReceiptInput = z.infer<typeof receiptSchema>;

export async function listReceipts(session: AppSession, p: ListParams): Promise<PagedResult<Record<string, unknown>>> {
  const w = docWhere(session, p, "customerId", "receiptDate");
  const [rows, total] = await Promise.all([
    prisma.receipt.findMany({ where: w, orderBy: orderByFrom(p.sort, ["number", "receiptDate", "amount", "status"], { receiptDate: "desc" }), ...skipTake(p), include: { customer: { select: { code: true, nameAr: true, nameEn: true } }, bankAccount: { select: { code: true } } } }),
    prisma.receipt.count({ where: w }),
  ]);
  return { rows, total, page: p.page, pageSize: p.pageSize };
}
export async function allReceipts(session: AppSession, p: ListParams) {
  return prisma.receipt.findMany({ where: docWhere(session, p, "customerId", "receiptDate"), orderBy: { receiptDate: "desc" }, take: 10_000, include: { customer: { select: { code: true, nameAr: true, nameEn: true } }, bankAccount: { select: { code: true } } } });
}
export async function getReceipt(session: AppSession, id: string) {
  return prisma.receipt.findFirst({ where: { id, companyId: session.companyId }, include: { customer: true, bankAccount: true, allocations: { include: { invoice: { select: { id: true, number: true, invoiceDate: true, dueDate: true, total: true, paidAmount: true, currencyCode: true } } } } } });
}

/** Open invoices for allocation (includes current allocations of the receipt being edited). */
export async function openInvoices(session: AppSession, customerId: string, receiptId?: string) {
  const invs = await prisma.customerInvoice.findMany({ where: { companyId: session.companyId, customerId, kind: { not: "CREDIT_NOTE" }, status: { in: [...OPEN_STATUSES] } }, orderBy: { dueDate: "asc" }, select: { id: true, number: true, invoiceDate: true, dueDate: true, total: true, paidAmount: true, currencyCode: true } });
  const current = receiptId ? await prisma.receiptAllocation.findMany({ where: { receiptId } }) : [];
  return invs.map((i) => ({ ...i, outstanding: D(i.total).minus(i.paidAmount).plus(D(current.find((a) => a.invoiceId === i.id)?.amount ?? 0)).toNumber(), allocated: Number(current.find((a) => a.invoiceId === i.id)?.amount ?? 0) }));
}

function validateAllocations(input: ReceiptInput) {
  const sum = input.allocations.reduce((a, x) => a + x.amount, 0);
  if (sum > input.amount + 0.005) throw new Error("ALLOCATION_EXCEEDS_AMOUNT");
  return sum;
}

export async function saveReceipt(session: AppSession, input: ReceiptInput) {
  const allocated = validateAllocations(input);
  const rate = input.currencyCode === "SAR" ? D(1) : D(input.exchangeRate);
  const data = { customerId: input.customerId, branchId: input.branchId || null, receiptDate: new Date(input.receiptDate), method: input.method, bankAccountId: input.method === "CASH" ? null : input.bankAccountId || null, currencyCode: input.currencyCode, exchangeRate: rate, amount: input.amount, baseAmount: round(D(input.amount).times(rate), 2), allocatedAmount: allocated, reference: input.reference ?? null, notes: input.notes ?? null };
  const allocs = input.allocations.filter((a) => a.amount > 0).map((a) => ({ invoiceId: a.invoiceId, amount: a.amount }));
  return prisma.$transaction(async (tx) => {
    if (input.id) {
      const ex = await tx.receipt.findFirst({ where: { id: input.id, companyId: session.companyId } });
      if (!ex) throw new Error("NOT_FOUND");
      if (ex.status !== "DRAFT") throw new Error("NOT_DRAFT");
      await tx.receiptAllocation.deleteMany({ where: { receiptId: input.id } });
      return tx.receipt.update({ where: { id: input.id }, data: { ...data, updatedById: session.userId, allocations: { create: allocs } } });
    }
    const number = await nextDocumentNumber(tx, session.companyId, "RECEIPT", data.receiptDate);
    return tx.receipt.create({ data: { ...data, companyId: session.companyId, number, status: "DRAFT", createdById: session.userId, allocations: { create: allocs } } });
  });
}

/** Posts: Dr bank/cash, Cr AR; applies allocations to invoices. */
export async function postReceipt(session: AppSession, id: string) {
  return prisma.$transaction(async (tx) => {
    const r = await tx.receipt.findFirst({ where: { id, companyId: session.companyId }, include: { customer: true, bankAccount: true, allocations: true } });
    if (!r) throw new Error("NOT_FOUND");
    if (r.status !== "DRAFT") throw new Error("NOT_DRAFT");
    const cashOrBank = r.bankAccount?.accountId ?? (await mappedAccount(tx, session.companyId, r.method === "CASH" ? "CASH" : "BANK_DEFAULT"));
    const ar = r.customer.receivableAccountId ?? (await mappedAccount(tx, session.companyId, "AR"));
    const entry = await postJournal(tx, {
      companyId: session.companyId, branchId: r.branchId, entryDate: r.receiptDate, description: `Receipt ${r.number} — ${r.customer.nameEn}`, reference: r.reference ?? r.number, source: "AR_RECEIPT", sourceType: "Receipt", sourceId: r.id, currencyCode: r.currencyCode, exchangeRate: r.exchangeRate, userId: session.userId,
      lines: [
        { accountId: cashOrBank, debit: r.amount, description: `${r.number}` },
        { accountId: ar, credit: r.amount, description: `${r.number}`, partyType: "CUSTOMER", partyId: r.customerId },
      ],
    });
    for (const a of r.allocations) {
      const inv = await tx.customerInvoice.findFirstOrThrow({ where: { id: a.invoiceId } });
      const paid = D(inv.paidAmount).plus(a.amount);
      if (paid.gt(D(inv.total).plus(0.005))) throw new Error("ALLOCATION_EXCEEDS_INVOICE");
      await tx.customerInvoice.update({ where: { id: inv.id }, data: { paidAmount: paid, status: paid.gte(inv.total) ? "PAID" : "PARTIALLY_PAID" } });
    }
    await tx.receipt.update({ where: { id }, data: { status: "POSTED", journalEntryId: entry.id, updatedById: session.userId } });
    return { status: "POSTED" as const };
  });
}

export async function reverseReceipt(session: AppSession, id: string) {
  return prisma.$transaction(async (tx) => {
    const r = await tx.receipt.findFirst({ where: { id, companyId: session.companyId }, include: { allocations: true } });
    if (!r) throw new Error("NOT_FOUND");
    if (r.status !== "POSTED") throw new Error("NOT_POSTED");
    for (const a of r.allocations) {
      const inv = await tx.customerInvoice.findFirstOrThrow({ where: { id: a.invoiceId } });
      const paid = D(inv.paidAmount).minus(a.amount);
      await tx.customerInvoice.update({ where: { id: inv.id }, data: { paidAmount: paid, status: paid.lte(0) ? "POSTED" : "PARTIALLY_PAID" } });
    }
    if (r.journalEntryId) await reverseJournal(tx, session.companyId, r.journalEntryId, session.userId);
    return tx.receipt.update({ where: { id }, data: { status: "REVERSED", updatedById: session.userId } });
  });
}

export async function deleteReceiptDraft(session: AppSession, id: string) {
  const r = await prisma.receipt.findFirst({ where: { id, companyId: session.companyId } });
  if (!r) throw new Error("NOT_FOUND");
  if (r.status !== "DRAFT") throw new Error("NOT_DRAFT");
  return prisma.receipt.delete({ where: { id } });
}

export function receiptColumns(tf: (k: string) => string, t: (k: string) => string): ColumnDef[] {
  return [
    { key: "number", label: tf("number"), sortable: true, type: "link", hrefTemplate: "/finance/ar/receipts/{id}" },
    { key: "receiptDate", label: tf("date"), type: "date", sortable: true },
    { key: "customer", label: t("customer"), bilingual: "customer.name" },
    { key: "method", label: t("method"), type: "enum", enumName: "PaymentMethod" },
    { key: "bankAccount", label: t("bankAccount"), path: "bankAccount.code" },
    { key: "reference", label: t("reference"), hidden: true },
    { key: "amount", label: tf("amount"), type: "money", align: "end", sortable: true, currencyPath: "currencyCode" },
    { key: "allocatedAmount", label: t("allocated"), type: "money", align: "end", currencyPath: "currencyCode" },
    { key: "status", label: tf("status"), type: "enum", enumName: "DocStatus", tones: { DRAFT: "secondary", POSTED: "success", REVERSED: "destructive" } },
  ];
}
