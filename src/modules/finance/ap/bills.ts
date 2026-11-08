import { z } from "zod";
import { prisma, type Tx } from "@/lib/prisma";
import type { AppSession } from "@/core/auth/session";
import { orderByFrom, skipTake, type ColumnDef, type ListParams, type PagedResult } from "@/components/data-table/types";
import { nextDocumentNumber } from "@/core/numbering";
import { postJournal, reverseJournal, mappedAccount, type PostingLine } from "@/core/posting";
import { submitForApproval } from "@/core/approvals/engine";
import { registerApprovalHooks, DOC_LINKS } from "@/modules/foundation/approvals/hooks";
import { D, round } from "@/lib/money";
import { computeDocument, docHeaderSchema, docWhere, OPEN_STATUSES, agingBuckets } from "../_shared/docs";

export const billSchema = docHeaderSchema.extend({
  vendorId: z.string().min(1),
  vendorInvoiceNumber: z.string().max(60).nullable().optional(),
});
export type BillInput = z.infer<typeof billSchema>;

export const billInclude = { vendor: true, lines: { orderBy: { lineNo: "asc" as const }, include: { taxCode: { select: { code: true } } } }, allocations: { include: { payment: { select: { id: true, number: true, paymentDate: true } } } } };

export async function listBills(session: AppSession, p: ListParams): Promise<PagedResult<Record<string, unknown>>> {
  const w = docWhere(session, p, "vendorId", "billDate");
  if (p.filters.overdue === "true") Object.assign(w, { status: { in: [...OPEN_STATUSES] }, dueDate: { lt: new Date() } });
  const [rows, total] = await Promise.all([
    prisma.vendorBill.findMany({ where: w, orderBy: orderByFrom(p.sort, ["number", "billDate", "dueDate", "total", "status"], { billDate: "desc" }), ...skipTake(p), include: { vendor: { select: { code: true, nameAr: true, nameEn: true } } } }),
    prisma.vendorBill.count({ where: w }),
  ]);
  return { rows: rows.map((r) => ({ ...r, outstanding: D(r.total).minus(r.paidAmount) })), total, page: p.page, pageSize: p.pageSize };
}
export async function allBills(session: AppSession, p: ListParams) {
  const rows = await prisma.vendorBill.findMany({ where: docWhere(session, p, "vendorId", "billDate"), orderBy: { billDate: "desc" }, take: 10_000, include: { vendor: { select: { code: true, nameAr: true, nameEn: true } } } });
  return rows.map((r) => ({ ...r, outstanding: D(r.total).minus(r.paidAmount) }));
}
export async function getBill(session: AppSession, id: string) {
  return prisma.vendorBill.findFirst({ where: { id, companyId: session.companyId }, include: billInclude });
}

export async function saveBill(session: AppSession, input: BillInput) {
  const vendor = await prisma.vendor.findFirst({ where: { id: input.vendorId, companyId: session.companyId } });
  if (!vendor) throw new Error("NOT_FOUND");
  const { computed, subtotal, discountTotal, taxTotal, total } = await computeDocument(prisma, session.companyId, input.lines, input.discountPct);
  const rate = input.currencyCode === "SAR" ? D(1) : D(input.exchangeRate);
  const billDate = new Date(input.docDate);
  const data = { branchId: input.branchId || null, vendorId: input.vendorId, vendorInvoiceNumber: input.vendorInvoiceNumber ?? null, billDate, dueDate: new Date(input.dueDate), currencyCode: input.currencyCode, exchangeRate: rate, subtotal, discountTotal, taxTotal, total, baseTotal: round(total.times(rate), 2), reference: input.reference ?? null, notes: input.notes ?? null };
  const lineData = input.lines.map((l, i) => ({ lineNo: i + 1, itemId: l.itemId || null, descriptionAr: l.descriptionAr, descriptionEn: l.descriptionEn, quantity: l.quantity, unitPrice: l.unitPrice, discountPct: l.discountPct, discountAmount: computed[i].discountAmount, taxCodeId: l.taxCodeId || null, taxRate: computed[i].taxRate, net: computed[i].net, tax: computed[i].tax, total: computed[i].total, expenseAccountId: l.accountId || null, costCenterId: l.costCenterId || null }));
  return prisma.$transaction(async (tx) => {
    if (input.id) {
      const ex = await tx.vendorBill.findFirst({ where: { id: input.id, companyId: session.companyId } });
      if (!ex) throw new Error("NOT_FOUND");
      if (ex.status !== "DRAFT") throw new Error("NOT_DRAFT");
      await tx.billLine.deleteMany({ where: { billId: input.id } });
      return tx.vendorBill.update({ where: { id: input.id }, data: { ...data, updatedById: session.userId, lines: { create: lineData } } });
    }
    const number = await nextDocumentNumber(tx, session.companyId, "BILL", billDate);
    return tx.vendorBill.create({ data: { ...data, companyId: session.companyId, number, status: "DRAFT", createdById: session.userId, lines: { create: lineData } } });
  });
}

export async function postBill(session: AppSession, id: string) {
  return prisma.$transaction(async (tx) => {
    const b = await tx.vendorBill.findFirst({ where: { id, companyId: session.companyId } });
    if (!b) throw new Error("NOT_FOUND");
    if (b.status !== "DRAFT" && b.status !== "APPROVED") throw new Error("NOT_DRAFT");
    if (b.status === "DRAFT") {
      const req = await submitForApproval(tx, { companyId: session.companyId, docType: "BILL", docId: b.id, docNumber: b.number, amount: b.baseTotal, requestedById: session.userId, link: `/finance/ap/bills/${b.id}` });
      if (req) {
        await tx.vendorBill.update({ where: { id }, data: { status: "PENDING_APPROVAL" } });
        return { status: "PENDING_APPROVAL" as const };
      }
    }
    await postBillTx(tx, session.userId, id);
    return { status: "POSTED" as const };
  });
}

export async function postBillTx(tx: Tx, userId: string, id: string) {
  const b = await tx.vendorBill.findFirstOrThrow({ where: { id }, include: { lines: { include: { item: true, taxCode: true } }, vendor: true } });
  const companyId = b.companyId;
  const ap = b.vendor.payableAccountId ?? (await mappedAccount(tx, companyId, "AP"));
  const vatIn = await mappedAccount(tx, companyId, "VAT_INPUT");
  const defaultExpense = await mappedAccount(tx, companyId, "PURCHASE_EXPENSE");
  const lines: PostingLine[] = [];
  for (const l of b.lines) {
    const expense = l.expenseAccountId ?? l.item?.expenseAccountId ?? defaultExpense;
    if (!D(l.net).isZero()) lines.push({ accountId: expense, costCenterId: l.costCenterId, description: l.descriptionEn, debit: l.net, ...(D(l.tax).isZero() && l.taxCodeId ? { taxCodeId: l.taxCodeId, taxBase: l.net } : {}) });
    if (!D(l.tax).isZero()) lines.push({ accountId: vatIn, costCenterId: l.costCenterId, description: `VAT ${l.taxCode?.code ?? ""}`, debit: l.tax, taxCodeId: l.taxCodeId, taxBase: l.net });
  }
  lines.push({ accountId: ap, credit: b.total, description: `${b.number} ${b.vendor.nameEn}`, partyType: "VENDOR", partyId: b.vendorId });
  const entry = await postJournal(tx, { companyId, branchId: b.branchId, entryDate: b.billDate, description: `Bill ${b.number} — ${b.vendor.nameEn}${b.vendorInvoiceNumber ? ` (${b.vendorInvoiceNumber})` : ""}`, reference: b.vendorInvoiceNumber ?? b.number, source: "AP_BILL", sourceType: "VendorBill", sourceId: b.id, currencyCode: b.currencyCode, exchangeRate: b.exchangeRate, lines, userId });
  await tx.vendorBill.update({ where: { id }, data: { status: "POSTED", journalEntryId: entry.id, updatedById: userId } });
}

export async function cancelBill(session: AppSession, id: string) {
  const b = await prisma.vendorBill.findFirst({ where: { id, companyId: session.companyId } });
  if (!b) throw new Error("NOT_FOUND");
  if (b.status !== "DRAFT" && b.status !== "PENDING_APPROVAL") throw new Error("NOT_DRAFT");
  await prisma.approvalRequest.updateMany({ where: { docType: "BILL", docId: id, status: "PENDING" }, data: { status: "CANCELLED" } });
  return prisma.vendorBill.update({ where: { id }, data: { status: "CANCELLED", updatedById: session.userId } });
}

export async function reverseBill(session: AppSession, id: string) {
  return prisma.$transaction(async (tx) => {
    const b = await tx.vendorBill.findFirst({ where: { id, companyId: session.companyId } });
    if (!b) throw new Error("NOT_FOUND");
    if (b.status !== "POSTED" || !D(b.paidAmount).isZero()) throw new Error("HAS_PAYMENTS");
    if (b.journalEntryId) await reverseJournal(tx, session.companyId, b.journalEntryId, session.userId);
    return tx.vendorBill.update({ where: { id }, data: { status: "REVERSED", updatedById: session.userId } });
  });
}

export function billColumns(tf: (k: string) => string, t: (k: string) => string): ColumnDef[] {
  return [
    { key: "number", label: tf("number"), sortable: true, type: "link", hrefTemplate: "/finance/ap/bills/{id}" },
    { key: "billDate", label: tf("date"), type: "date", sortable: true },
    { key: "vendor", label: t("vendor"), bilingual: "vendor.name" },
    { key: "vendorInvoiceNumber", label: t("vendorInvoiceNumber") },
    { key: "dueDate", label: t("dueDate"), type: "date", sortable: true },
    { key: "total", label: t("total"), type: "money", align: "end", sortable: true, currencyPath: "currencyCode" },
    { key: "paidAmount", label: t("paid"), type: "money", align: "end", currencyPath: "currencyCode" },
    { key: "outstanding", label: t("outstanding"), type: "money", align: "end", currencyPath: "currencyCode" },
    { key: "status", label: tf("status"), type: "enum", enumName: "DocStatus", tones: { DRAFT: "secondary", PENDING_APPROVAL: "warning", APPROVED: "info", POSTED: "info", PARTIALLY_PAID: "warning", PAID: "success", CANCELLED: "destructive", REVERSED: "destructive" } },
  ];
}

export async function apAging(session: AppSession, asOf: Date, vendorId?: string) {
  const rows = await prisma.vendorBill.findMany({ where: { companyId: session.companyId, status: { in: [...OPEN_STATUSES] }, billDate: { lte: asOf }, vendorId: vendorId || undefined }, include: { vendor: { select: { id: true, code: true, nameAr: true, nameEn: true } } } });
  const by = new Map<string, Record<string, unknown> & { current: number; d1_30: number; d31_60: number; d61_90: number; d90plus: number; total: number }>();
  for (const r of rows) {
    const out = D(r.baseTotal).minus(r.paidAmount).toNumber();
    if (out <= 0) continue;
    const b = agingBuckets(asOf, r.dueDate, out);
    const v = by.get(r.vendorId) ?? { id: r.vendorId, code: r.vendor.code, nameAr: r.vendor.nameAr, nameEn: r.vendor.nameEn, current: 0, d1_30: 0, d31_60: 0, d61_90: 0, d90plus: 0, total: 0 };
    v.current += b.current; v.d1_30 += b.d1_30; v.d31_60 += b.d31_60; v.d61_90 += b.d61_90; v.d90plus += b.d90plus; v.total += out;
    by.set(r.vendorId, v);
  }
  return [...by.values()].sort((a, b) => b.total - a.total);
}

registerApprovalHooks("BILL", {
  onApproved: async (tx, req) => {
    const b = await tx.vendorBill.update({ where: { id: req.docId }, data: { status: "APPROVED" } });
    await postBillTx(tx, b.updatedById ?? b.createdById ?? "system", b.id);
  },
  onRejected: async (tx, req) => {
    await tx.vendorBill.update({ where: { id: req.docId }, data: { status: "DRAFT" } });
  },
});
DOC_LINKS.BILL = (id) => `/finance/ap/bills/${id}`;
