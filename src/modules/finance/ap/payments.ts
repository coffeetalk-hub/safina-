import { z } from "zod";
import { prisma } from "@/lib/prisma";
import type { AppSession } from "@/core/auth/session";
import { orderByFrom, skipTake, type ColumnDef, type ListParams, type PagedResult } from "@/components/data-table/types";
import { nextDocumentNumber } from "@/core/numbering";
import { postJournal, reverseJournal, mappedAccount } from "@/core/posting";
import { submitForApproval } from "@/core/approvals/engine";
import { registerApprovalHooks, DOC_LINKS } from "@/modules/foundation/approvals/hooks";
import { D, round } from "@/lib/money";
import { docWhere, OPEN_STATUSES } from "../_shared/docs";
import type { Tx } from "@/lib/prisma";

export const paymentSchema = z.object({
  id: z.string().nullable().optional(),
  vendorId: z.string().min(1),
  branchId: z.string().nullable().optional(),
  paymentDate: z.string().min(10),
  method: z.enum(["CASH", "BANK_TRANSFER", "CHEQUE", "CARD", "OTHER"]).default("BANK_TRANSFER"),
  bankAccountId: z.string().nullable().optional(),
  currencyCode: z.string().length(3).default("SAR"),
  exchangeRate: z.coerce.number().positive().default(1),
  amount: z.coerce.number().positive(),
  reference: z.string().max(100).nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
  allocations: z.array(z.object({ billId: z.string(), amount: z.coerce.number().min(0) })).default([]),
});
export type PaymentInput = z.infer<typeof paymentSchema>;

export async function listPayments(session: AppSession, p: ListParams): Promise<PagedResult<Record<string, unknown>>> {
  const w = docWhere(session, p, "vendorId", "paymentDate");
  const [rows, total] = await Promise.all([
    prisma.payment.findMany({ where: w, orderBy: orderByFrom(p.sort, ["number", "paymentDate", "amount", "status"], { paymentDate: "desc" }), ...skipTake(p), include: { vendor: { select: { code: true, nameAr: true, nameEn: true } }, bankAccount: { select: { code: true } } } }),
    prisma.payment.count({ where: w }),
  ]);
  return { rows, total, page: p.page, pageSize: p.pageSize };
}
export async function allPayments(session: AppSession, p: ListParams) {
  return prisma.payment.findMany({ where: docWhere(session, p, "vendorId", "paymentDate"), orderBy: { paymentDate: "desc" }, take: 10_000, include: { vendor: { select: { code: true, nameAr: true, nameEn: true } }, bankAccount: { select: { code: true } } } });
}
export async function getPayment(session: AppSession, id: string) {
  return prisma.payment.findFirst({ where: { id, companyId: session.companyId }, include: { vendor: true, bankAccount: true, allocations: { include: { bill: { select: { id: true, number: true, billDate: true, dueDate: true, total: true, paidAmount: true, currencyCode: true, vendorInvoiceNumber: true } } } } } });
}
export async function openBills(session: AppSession, vendorId: string, paymentId?: string) {
  const bills = await prisma.vendorBill.findMany({ where: { companyId: session.companyId, vendorId, status: { in: [...OPEN_STATUSES] } }, orderBy: { dueDate: "asc" }, select: { id: true, number: true, billDate: true, dueDate: true, total: true, paidAmount: true, currencyCode: true, vendorInvoiceNumber: true } });
  const current = paymentId ? await prisma.paymentAllocation.findMany({ where: { paymentId } }) : [];
  return bills.map((b) => ({ ...b, outstanding: D(b.total).minus(b.paidAmount).plus(D(current.find((a) => a.billId === b.id)?.amount ?? 0)).toNumber(), allocated: Number(current.find((a) => a.billId === b.id)?.amount ?? 0) }));
}

export async function savePayment(session: AppSession, input: PaymentInput) {
  const allocated = input.allocations.reduce((a, x) => a + x.amount, 0);
  if (allocated > input.amount + 0.005) throw new Error("ALLOCATION_EXCEEDS_AMOUNT");
  const rate = input.currencyCode === "SAR" ? D(1) : D(input.exchangeRate);
  const data = { vendorId: input.vendorId, branchId: input.branchId || null, paymentDate: new Date(input.paymentDate), method: input.method, bankAccountId: input.method === "CASH" ? null : input.bankAccountId || null, currencyCode: input.currencyCode, exchangeRate: rate, amount: input.amount, baseAmount: round(D(input.amount).times(rate), 2), allocatedAmount: allocated, reference: input.reference ?? null, notes: input.notes ?? null };
  const allocs = input.allocations.filter((a) => a.amount > 0).map((a) => ({ billId: a.billId, amount: a.amount }));
  return prisma.$transaction(async (tx) => {
    if (input.id) {
      const ex = await tx.payment.findFirst({ where: { id: input.id, companyId: session.companyId } });
      if (!ex) throw new Error("NOT_FOUND");
      if (ex.status !== "DRAFT") throw new Error("NOT_DRAFT");
      await tx.paymentAllocation.deleteMany({ where: { paymentId: input.id } });
      return tx.payment.update({ where: { id: input.id }, data: { ...data, updatedById: session.userId, allocations: { create: allocs } } });
    }
    const number = await nextDocumentNumber(tx, session.companyId, "PAYMENT", data.paymentDate);
    return tx.payment.create({ data: { ...data, companyId: session.companyId, number, status: "DRAFT", createdById: session.userId, allocations: { create: allocs } } });
  });
}

export async function postPayment(session: AppSession, id: string) {
  return prisma.$transaction(async (tx) => {
    const p = await tx.payment.findFirst({ where: { id, companyId: session.companyId } });
    if (!p) throw new Error("NOT_FOUND");
    if (p.status !== "DRAFT" && p.status !== "APPROVED") throw new Error("NOT_DRAFT");
    if (p.status === "DRAFT") {
      const req = await submitForApproval(tx, { companyId: session.companyId, docType: "PAYMENT", docId: p.id, docNumber: p.number, amount: p.baseAmount, requestedById: session.userId, link: `/finance/ap/payments/${p.id}` });
      if (req) {
        await tx.payment.update({ where: { id }, data: { status: "PENDING_APPROVAL" } });
        return { status: "PENDING_APPROVAL" as const };
      }
    }
    await postPaymentTx(tx, session.userId, id);
    return { status: "POSTED" as const };
  });
}

export async function postPaymentTx(tx: Tx, userId: string, id: string) {
  const p = await tx.payment.findFirstOrThrow({ where: { id }, include: { vendor: true, bankAccount: true, allocations: true } });
  const companyId = p.companyId;
  const cashOrBank = p.bankAccount?.accountId ?? (await mappedAccount(tx, companyId, p.method === "CASH" ? "CASH" : "BANK_DEFAULT"));
  const ap = p.vendor.payableAccountId ?? (await mappedAccount(tx, companyId, "AP"));
  const entry = await postJournal(tx, {
    companyId, branchId: p.branchId, entryDate: p.paymentDate, description: `Payment ${p.number} — ${p.vendor.nameEn}`, reference: p.reference ?? p.number, source: "AP_PAYMENT", sourceType: "Payment", sourceId: p.id, currencyCode: p.currencyCode, exchangeRate: p.exchangeRate, userId,
    lines: [
      { accountId: ap, debit: p.amount, description: p.number, partyType: "VENDOR", partyId: p.vendorId },
      { accountId: cashOrBank, credit: p.amount, description: p.number },
    ],
  });
  for (const a of p.allocations) {
    const bill = await tx.vendorBill.findFirstOrThrow({ where: { id: a.billId } });
    const paid = D(bill.paidAmount).plus(a.amount);
    if (paid.gt(D(bill.total).plus(0.005))) throw new Error("ALLOCATION_EXCEEDS_INVOICE");
    await tx.vendorBill.update({ where: { id: bill.id }, data: { paidAmount: paid, status: paid.gte(bill.total) ? "PAID" : "PARTIALLY_PAID" } });
  }
  await tx.payment.update({ where: { id }, data: { status: "POSTED", journalEntryId: entry.id, updatedById: userId } });
}

export async function reversePayment(session: AppSession, id: string) {
  return prisma.$transaction(async (tx) => {
    const p = await tx.payment.findFirst({ where: { id, companyId: session.companyId }, include: { allocations: true } });
    if (!p) throw new Error("NOT_FOUND");
    if (p.status !== "POSTED") throw new Error("NOT_POSTED");
    for (const a of p.allocations) {
      const bill = await tx.vendorBill.findFirstOrThrow({ where: { id: a.billId } });
      const paid = D(bill.paidAmount).minus(a.amount);
      await tx.vendorBill.update({ where: { id: bill.id }, data: { paidAmount: paid, status: paid.lte(0) ? "POSTED" : "PARTIALLY_PAID" } });
    }
    if (p.journalEntryId) await reverseJournal(tx, session.companyId, p.journalEntryId, session.userId);
    return tx.payment.update({ where: { id }, data: { status: "REVERSED", updatedById: session.userId } });
  });
}

export async function deletePaymentDraft(session: AppSession, id: string) {
  const p = await prisma.payment.findFirst({ where: { id, companyId: session.companyId } });
  if (!p) throw new Error("NOT_FOUND");
  if (p.status !== "DRAFT") throw new Error("NOT_DRAFT");
  return prisma.payment.delete({ where: { id } });
}

export function paymentColumns(tf: (k: string) => string, t: (k: string) => string): ColumnDef[] {
  return [
    { key: "number", label: tf("number"), sortable: true, type: "link", hrefTemplate: "/finance/ap/payments/{id}" },
    { key: "paymentDate", label: tf("date"), type: "date", sortable: true },
    { key: "vendor", label: t("vendor"), bilingual: "vendor.name" },
    { key: "method", label: t("method"), type: "enum", enumName: "PaymentMethod" },
    { key: "bankAccount", label: t("bankAccount"), path: "bankAccount.code" },
    { key: "reference", label: t("reference"), hidden: true },
    { key: "amount", label: tf("amount"), type: "money", align: "end", sortable: true, currencyPath: "currencyCode" },
    { key: "allocatedAmount", label: t("allocated"), type: "money", align: "end", currencyPath: "currencyCode" },
    { key: "status", label: tf("status"), type: "enum", enumName: "DocStatus", tones: { DRAFT: "secondary", PENDING_APPROVAL: "warning", POSTED: "success", REVERSED: "destructive" } },
  ];
}

registerApprovalHooks("PAYMENT", {
  onApproved: async (tx, req) => {
    const p = await tx.payment.update({ where: { id: req.docId }, data: { status: "APPROVED" } });
    await postPaymentTx(tx, p.updatedById ?? p.createdById ?? "system", p.id);
  },
  onRejected: async (tx, req) => {
    await tx.payment.update({ where: { id: req.docId }, data: { status: "DRAFT" } });
  },
});
DOC_LINKS.PAYMENT = (id) => `/finance/ap/payments/${id}`;
