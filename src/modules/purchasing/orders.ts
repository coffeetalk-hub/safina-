import { z } from "zod";
import { prisma } from "@/lib/prisma";
import type { AppSession } from "@/core/auth/session";
import { orderByFrom, skipTake, type ColumnDef, type ListParams, type PagedResult } from "@/components/data-table/types";
import { nextDocumentNumber } from "@/core/numbering";
import { D, round } from "@/lib/money";
import { computeDocument, docHeaderSchema, docWhere } from "@/modules/finance/_shared/docs";
import { submitForApproval } from "@/core/approvals/engine";
import { registerApprovalHooks, DOC_LINKS } from "@/modules/foundation/approvals/hooks";

export const poSchema = docHeaderSchema.extend({ vendorId: z.string().min(1), requestId: z.string().nullable().optional(), rfqId: z.string().nullable().optional(), contractId: z.string().nullable().optional(), termsAr: z.string().max(2000).nullable().optional(), termsEn: z.string().max(2000).nullable().optional(), dueDate: z.string().nullable().optional() });
export type PoInput = z.infer<typeof poSchema>;
const partyInclude = { vendor: { select: { code: true, nameAr: true, nameEn: true } } };

export async function listPurchaseOrders(session: AppSession, p: ListParams): Promise<PagedResult<Record<string, unknown>>> {
  const w = docWhere(session, p, "vendorId", "orderDate");
  const [rows, total] = await Promise.all([prisma.purchaseOrder.findMany({ where: w, orderBy: orderByFrom(p.sort, ["number", "orderDate", "expectedDate", "total", "status"], { orderDate: "desc" }), ...skipTake(p), include: partyInclude }), prisma.purchaseOrder.count({ where: w })]);
  return { rows, total, page: p.page, pageSize: p.pageSize };
}
export async function allPurchaseOrders(session: AppSession, p: ListParams) { return prisma.purchaseOrder.findMany({ where: docWhere(session, p, "vendorId", "orderDate"), orderBy: { orderDate: "desc" }, take: 10_000, include: partyInclude }); }
export async function getPurchaseOrder(session: AppSession, id: string) {
  const o = await prisma.purchaseOrder.findFirst({ where: { id, companyId: session.companyId }, include: { vendor: true, lines: { orderBy: { lineNo: "asc" } }, request: { select: { id: true, number: true } } } });
  if (!o) return null;
  const bills = await prisma.vendorBill.findMany({ where: { companyId: session.companyId, sourceType: "PurchaseOrder", sourceId: id }, select: { id: true, number: true, status: true, total: true } });
  const rfq = o.rfqId ? await prisma.rfq.findUnique({ where: { id: o.rfqId }, select: { id: true, number: true } }) : null;
  return { ...o, bills, rfq };
}
export async function savePurchaseOrder(session: AppSession, input: PoInput) {
  const { computed, subtotal, discountTotal, taxTotal, total } = await computeDocument(prisma, session.companyId, input.lines, input.discountPct);
  const rate = input.currencyCode === "SAR" ? D(1) : D(input.exchangeRate);
  const data = { branchId: input.branchId || null, vendorId: input.vendorId, requestId: input.requestId || null, rfqId: input.rfqId || null, contractId: input.contractId || null, orderDate: new Date(input.docDate), expectedDate: input.dueDate ? new Date(input.dueDate) : null, currencyCode: input.currencyCode, exchangeRate: rate, discountPct: input.discountPct, subtotal, discountTotal, taxTotal, total, reference: input.reference ?? null, notes: input.notes ?? null, termsAr: input.termsAr ?? null, termsEn: input.termsEn ?? null };
  const lines = input.lines.map((l, i) => ({ lineNo: i + 1, itemId: l.itemId || null, descriptionAr: l.descriptionAr, descriptionEn: l.descriptionEn, quantity: l.quantity, unitPrice: l.unitPrice, discountPct: l.discountPct, discountAmount: computed[i].discountAmount, taxCodeId: l.taxCodeId || null, taxRate: computed[i].taxRate, net: computed[i].net, tax: computed[i].tax, total: computed[i].total, expenseAccountId: l.accountId || null, costCenterId: l.costCenterId || null }));
  return prisma.$transaction(async (tx) => {
    if (input.id) {
      const ex = await tx.purchaseOrder.findFirst({ where: { id: input.id, companyId: session.companyId } });
      if (!ex) throw new Error("NOT_FOUND");
      if (ex.status !== "DRAFT") throw new Error("NOT_DRAFT");
      await tx.purchaseOrderLine.deleteMany({ where: { orderId: input.id } });
      return tx.purchaseOrder.update({ where: { id: input.id }, data: { ...data, updatedById: session.userId, lines: { create: lines } } });
    }
    const number = await nextDocumentNumber(tx, session.companyId, "PURCHASE_ORDER", data.orderDate);
    const po = await tx.purchaseOrder.create({ data: { ...data, companyId: session.companyId, number, createdById: session.userId, lines: { create: lines } } });
    if (data.requestId) await tx.purchaseRequest.update({ where: { id: data.requestId }, data: { status: "ORDERED" } });
    return po;
  });
}
/** Approve/confirm (approval policy PURCHASE_ORDER, e.g. > 10,000 in the seed). */
export async function confirmPurchaseOrder(session: AppSession, id: string) {
  return prisma.$transaction(async (tx) => {
    const o = await tx.purchaseOrder.findFirst({ where: { id, companyId: session.companyId } });
    if (!o) throw new Error("NOT_FOUND");
    if (o.status !== "DRAFT") throw new Error("NOT_DRAFT");
    const req = await submitForApproval(tx, { companyId: session.companyId, docType: "PURCHASE_ORDER", docId: o.id, docNumber: o.number, amount: round(D(o.total).times(o.exchangeRate), 2), requestedById: session.userId, link: `/purchasing/orders/${o.id}` });
    if (req) { await tx.purchaseOrder.update({ where: { id }, data: { status: "PENDING_APPROVAL" } }); return { status: "PENDING_APPROVAL" as const }; }
    await tx.purchaseOrder.update({ where: { id }, data: { status: "APPROVED", updatedById: session.userId } });
    return { status: "APPROVED" as const };
  });
}
export async function markPoSent(session: AppSession, id: string) {
  const o = await prisma.purchaseOrder.findFirst({ where: { id, companyId: session.companyId } });
  if (!o || o.status !== "APPROVED") throw new Error("INVALID_TRANSITION");
  return prisma.purchaseOrder.update({ where: { id }, data: { status: "SENT", updatedById: session.userId } });
}
export async function cancelPurchaseOrder(session: AppSession, id: string) {
  const o = await prisma.purchaseOrder.findFirst({ where: { id, companyId: session.companyId } });
  if (!o || !["DRAFT", "PENDING_APPROVAL", "APPROVED", "SENT"].includes(o.status) || !D(o.billedAmount).isZero()) throw new Error("INVALID_TRANSITION");
  await prisma.approvalRequest.updateMany({ where: { docType: "PURCHASE_ORDER", docId: id, status: "PENDING" }, data: { status: "CANCELLED" } });
  return prisma.purchaseOrder.update({ where: { id }, data: { status: "CANCELLED", updatedById: session.userId } });
}
/** One click: approved/sent PO → draft vendor bill. */
export async function convertPoToBill(session: AppSession, id: string) {
  const o = await getPurchaseOrder(session, id);
  if (!o) throw new Error("NOT_FOUND");
  if (!["APPROVED", "SENT", "PARTIALLY_BILLED"].includes(o.status)) throw new Error("INVALID_TRANSITION");
  const { saveBill } = await import("@/modules/finance/ap/bills");
  const bill = await saveBill(session, { vendorId: o.vendorId, branchId: o.branchId, docDate: new Date().toISOString().slice(0, 10), dueDate: new Date(Date.now() + o.vendor.paymentTermsDays * 86_400_000).toISOString().slice(0, 10), currencyCode: o.currencyCode, exchangeRate: Number(o.exchangeRate), discountPct: Number(o.discountPct), reference: o.number, notes: o.notes, vendorInvoiceNumber: null, lines: o.lines.map((l) => ({ itemId: l.itemId, descriptionAr: l.descriptionAr, descriptionEn: l.descriptionEn, quantity: Number(l.quantity), unitPrice: Number(l.unitPrice), discountPct: Number(l.discountPct), taxCodeId: l.taxCodeId, accountId: l.expenseAccountId, costCenterId: l.costCenterId })) });
  await prisma.vendorBill.update({ where: { id: bill.id }, data: { sourceType: "PurchaseOrder", sourceId: o.id } });
  await prisma.purchaseOrder.update({ where: { id }, data: { status: "BILLED", billedAmount: o.total, updatedById: session.userId } });
  return { id: bill.id };
}
export function poColumns(tf: (k: string) => string, t: (k: string) => string): ColumnDef[] {
  return [
    { key: "number", label: tf("number"), sortable: true, type: "link", hrefTemplate: "/purchasing/orders/{id}" },
    { key: "orderDate", label: tf("date"), type: "date", sortable: true },
    { key: "vendor", label: t("vendor"), bilingual: "vendor.name" },
    { key: "reference", label: t("reference") },
    { key: "expectedDate", label: t("expectedDate"), type: "date", sortable: true },
    { key: "total", label: t("total"), type: "money", align: "end", sortable: true, currencyPath: "currencyCode" },
    { key: "billedAmount", label: t("billed"), type: "money", align: "end", currencyPath: "currencyCode" },
    { key: "status", label: tf("status"), type: "enum", enumName: "PoStatus", tones: { DRAFT: "secondary", PENDING_APPROVAL: "warning", APPROVED: "info", SENT: "info", PARTIALLY_BILLED: "warning", BILLED: "success", CANCELLED: "destructive" } },
  ];
}
registerApprovalHooks("PURCHASE_ORDER", {
  onApproved: async (tx, req) => { await tx.purchaseOrder.update({ where: { id: req.docId }, data: { status: "APPROVED" } }); },
  onRejected: async (tx, req) => { await tx.purchaseOrder.update({ where: { id: req.docId }, data: { status: "DRAFT" } }); },
});
DOC_LINKS.PURCHASE_ORDER = (id) => `/purchasing/orders/${id}`;
