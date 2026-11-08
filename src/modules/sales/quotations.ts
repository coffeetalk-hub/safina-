import { z } from "zod";
import { prisma } from "@/lib/prisma";
import type { AppSession } from "@/core/auth/session";
import { orderByFrom, skipTake, type ColumnDef, type ListParams, type PagedResult } from "@/components/data-table/types";
import { nextDocumentNumber } from "@/core/numbering";
import { D, round } from "@/lib/money";
import { computeDocument, docHeaderSchema, docWhere } from "@/modules/finance/_shared/docs";
import { submitForApproval } from "@/core/approvals/engine";
import { registerApprovalHooks, DOC_LINKS } from "@/modules/foundation/approvals/hooks";
import { customerOutstanding } from "@/modules/finance/ar/invoices";

export const quotationSchema = docHeaderSchema.extend({ customerId: z.string().min(1), opportunityId: z.string().nullable().optional(), salespersonId: z.string().nullable().optional(), termsAr: z.string().max(2000).nullable().optional(), termsEn: z.string().max(2000).nullable().optional() });
export type QuotationInput = z.infer<typeof quotationSchema>;
export const orderSchema = docHeaderSchema.extend({ customerId: z.string().min(1), salespersonId: z.string().nullable().optional(), quotationId: z.string().nullable().optional() });
export type OrderInput = z.infer<typeof orderSchema>;

const lineData = (lines: QuotationInput["lines"], computed: Awaited<ReturnType<typeof computeDocument>>["computed"]) =>
  lines.map((l, i) => ({ lineNo: i + 1, itemId: l.itemId || null, descriptionAr: l.descriptionAr, descriptionEn: l.descriptionEn, quantity: l.quantity, unitPrice: l.unitPrice, discountPct: l.discountPct, discountAmount: computed[i].discountAmount, taxCodeId: l.taxCodeId || null, taxRate: computed[i].taxRate, net: computed[i].net, tax: computed[i].tax, total: computed[i].total, revenueAccountId: l.accountId || null, costCenterId: l.costCenterId || null }));

const partyInclude = { customer: { select: { code: true, nameAr: true, nameEn: true } } };

// ── Quotations
export async function listQuotations(session: AppSession, p: ListParams): Promise<PagedResult<Record<string, unknown>>> {
  const w = docWhere(session, p, "customerId", "quoteDate");
  if (p.filters.salespersonId) w.salespersonId = p.filters.salespersonId;
  const [rows, total] = await Promise.all([prisma.quotation.findMany({ where: w, orderBy: orderByFrom(p.sort, ["number", "quoteDate", "validUntil", "total", "status"], { quoteDate: "desc" }), ...skipTake(p), include: partyInclude }), prisma.quotation.count({ where: w })]);
  return { rows, total, page: p.page, pageSize: p.pageSize };
}
export async function allQuotations(session: AppSession, p: ListParams) {
  return prisma.quotation.findMany({ where: docWhere(session, p, "customerId", "quoteDate"), orderBy: { quoteDate: "desc" }, take: 10_000, include: partyInclude });
}
export async function getQuotation(session: AppSession, id: string) {
  return prisma.quotation.findFirst({ where: { id, companyId: session.companyId }, include: { customer: true, lines: { orderBy: { lineNo: "asc" } }, opportunity: { select: { id: true, titleAr: true, titleEn: true } } } });
}
export async function saveQuotation(session: AppSession, input: QuotationInput) {
  const { computed, subtotal, discountTotal, taxTotal, total } = await computeDocument(prisma, session.companyId, input.lines, input.discountPct);
  const rate = input.currencyCode === "SAR" ? D(1) : D(input.exchangeRate);
  const data = { branchId: input.branchId || null, customerId: input.customerId, opportunityId: input.opportunityId || null, quoteDate: new Date(input.docDate), validUntil: new Date(input.dueDate), currencyCode: input.currencyCode, exchangeRate: rate, discountPct: input.discountPct, subtotal, discountTotal, taxTotal, total, reference: input.reference ?? null, notes: input.notes ?? null, termsAr: input.termsAr ?? null, termsEn: input.termsEn ?? null, salespersonId: input.salespersonId || null };
  return prisma.$transaction(async (tx) => {
    if (input.id) {
      const ex = await tx.quotation.findFirst({ where: { id: input.id, companyId: session.companyId } });
      if (!ex) throw new Error("NOT_FOUND");
      if (ex.status !== "DRAFT") throw new Error("NOT_DRAFT");
      await tx.quotationLine.deleteMany({ where: { quotationId: input.id } });
      return tx.quotation.update({ where: { id: input.id }, data: { ...data, updatedById: session.userId, lines: { create: lineData(input.lines, computed) } } });
    }
    const number = await nextDocumentNumber(tx, session.companyId, "QUOTATION", data.quoteDate);
    const q = await tx.quotation.create({ data: { ...data, companyId: session.companyId, number, createdById: session.userId, lines: { create: lineData(input.lines, computed) } } });
    if (data.opportunityId) await tx.opportunity.update({ where: { id: data.opportunityId }, data: { amount: round(total.times(rate), 2) } });
    return q;
  });
}
const QUOTE_FLOW: Record<string, string[]> = { DRAFT: ["SENT", "CANCELLED"], SENT: ["ACCEPTED", "REJECTED", "EXPIRED", "DRAFT"], ACCEPTED: ["CONVERTED"], REJECTED: ["DRAFT"], EXPIRED: ["DRAFT"] };
export async function setQuotationStatus(session: AppSession, id: string, status: "DRAFT" | "SENT" | "ACCEPTED" | "REJECTED" | "EXPIRED" | "CANCELLED") {
  const q = await prisma.quotation.findFirst({ where: { id, companyId: session.companyId } });
  if (!q) throw new Error("NOT_FOUND");
  if (!QUOTE_FLOW[q.status]?.includes(status)) throw new Error("INVALID_TRANSITION");
  return prisma.quotation.update({ where: { id }, data: { status, updatedById: session.userId } });
}
/** One click: accepted (or sent) quotation → confirmed-ready sales order (draft). */
export async function convertQuotationToOrder(session: AppSession, id: string) {
  const q = await getQuotation(session, id);
  if (!q) throw new Error("NOT_FOUND");
  if (q.salesOrderId) return { id: q.salesOrderId };
  if (!["SENT", "ACCEPTED", "DRAFT"].includes(q.status)) throw new Error("INVALID_TRANSITION");
  const order = await saveOrder(session, { customerId: q.customerId, branchId: q.branchId, quotationId: q.id, docDate: new Date().toISOString().slice(0, 10), dueDate: new Date().toISOString().slice(0, 10), currencyCode: q.currencyCode, exchangeRate: Number(q.exchangeRate), discountPct: Number(q.discountPct), reference: q.reference, notes: q.notes, salespersonId: q.salespersonId, lines: q.lines.map((l) => ({ itemId: l.itemId, descriptionAr: l.descriptionAr, descriptionEn: l.descriptionEn, quantity: Number(l.quantity), unitPrice: Number(l.unitPrice), discountPct: Number(l.discountPct), taxCodeId: l.taxCodeId, accountId: l.revenueAccountId, costCenterId: l.costCenterId })) });
  await prisma.quotation.update({ where: { id }, data: { status: "CONVERTED", salesOrderId: order.id, updatedById: session.userId } });
  return { id: order.id };
}
export function quotationColumns(tf: (k: string) => string, t: (k: string) => string): ColumnDef[] {
  return [
    { key: "number", label: tf("number"), sortable: true, type: "link", hrefTemplate: "/sales/quotations/{id}" },
    { key: "quoteDate", label: tf("date"), type: "date", sortable: true },
    { key: "customer", label: t("customer"), bilingual: "customer.name" },
    { key: "validUntil", label: t("validUntil"), type: "date", sortable: true },
    { key: "reference", label: t("reference"), hidden: true },
    { key: "total", label: t("total"), type: "money", align: "end", sortable: true, currencyPath: "currencyCode" },
    { key: "status", label: tf("status"), type: "enum", enumName: "QuoteStatus", tones: { DRAFT: "secondary", SENT: "info", ACCEPTED: "success", REJECTED: "destructive", EXPIRED: "warning", CONVERTED: "success", CANCELLED: "destructive" } },
  ];
}

// ── Sales orders
export async function listOrders(session: AppSession, p: ListParams): Promise<PagedResult<Record<string, unknown>>> {
  const w = docWhere(session, p, "customerId", "orderDate");
  if (p.filters.salespersonId) w.salespersonId = p.filters.salespersonId;
  const [rows, total] = await Promise.all([prisma.salesOrder.findMany({ where: w, orderBy: orderByFrom(p.sort, ["number", "orderDate", "deliveryDate", "total", "status"], { orderDate: "desc" }), ...skipTake(p), include: partyInclude }), prisma.salesOrder.count({ where: w })]);
  return { rows, total, page: p.page, pageSize: p.pageSize };
}
export async function allOrders(session: AppSession, p: ListParams) {
  return prisma.salesOrder.findMany({ where: docWhere(session, p, "customerId", "orderDate"), orderBy: { orderDate: "desc" }, take: 10_000, include: partyInclude });
}
export async function getOrder(session: AppSession, id: string) {
  const o = await prisma.salesOrder.findFirst({ where: { id, companyId: session.companyId }, include: { customer: true, lines: { orderBy: { lineNo: "asc" } } } });
  if (!o) return null;
  const invoices = await prisma.customerInvoice.findMany({ where: { companyId: session.companyId, sourceType: "SalesOrder", sourceId: id }, select: { id: true, number: true, invoiceDate: true, total: true, status: true } });
  return { ...o, invoices };
}
export async function saveOrder(session: AppSession, input: OrderInput) {
  const { computed, subtotal, discountTotal, taxTotal, total } = await computeDocument(prisma, session.companyId, input.lines, input.discountPct);
  const rate = input.currencyCode === "SAR" ? D(1) : D(input.exchangeRate);
  const data = { branchId: input.branchId || null, customerId: input.customerId, quotationId: input.quotationId || null, orderDate: new Date(input.docDate), deliveryDate: input.dueDate ? new Date(input.dueDate) : null, currencyCode: input.currencyCode, exchangeRate: rate, discountPct: input.discountPct, subtotal, discountTotal, taxTotal, total, reference: input.reference ?? null, notes: input.notes ?? null, salespersonId: input.salespersonId || null };
  return prisma.$transaction(async (tx) => {
    if (input.id) {
      const ex = await tx.salesOrder.findFirst({ where: { id: input.id, companyId: session.companyId } });
      if (!ex) throw new Error("NOT_FOUND");
      if (ex.status !== "DRAFT") throw new Error("NOT_DRAFT");
      await tx.salesOrderLine.deleteMany({ where: { orderId: input.id } });
      return tx.salesOrder.update({ where: { id: input.id }, data: { ...data, updatedById: session.userId, lines: { create: lineData(input.lines, computed) } } });
    }
    const number = await nextDocumentNumber(tx, session.companyId, "SALES_ORDER", data.orderDate);
    return tx.salesOrder.create({ data: { ...data, companyId: session.companyId, number, createdById: session.userId, lines: { create: lineData(input.lines, computed) } } });
  });
}
/** Confirm: credit-limit check, optional approval policy (SALES_ORDER). */
export async function confirmOrder(session: AppSession, id: string, overrideCredit = false) {
  return prisma.$transaction(async (tx) => {
    const o = await tx.salesOrder.findFirst({ where: { id, companyId: session.companyId }, include: { customer: true } });
    if (!o) throw new Error("NOT_FOUND");
    if (o.status !== "DRAFT") throw new Error("NOT_DRAFT");
    if (o.customer.blockOnCreditExceed && D(o.customer.creditLimit).gt(0) && !overrideCredit) {
      const outstanding = await customerOutstanding(session.companyId, o.customerId);
      const base = round(D(o.total).times(o.exchangeRate), 2);
      if (outstanding.plus(base).gt(o.customer.creditLimit)) throw new Error(`CREDIT_LIMIT_EXCEEDED:${outstanding.plus(base).minus(o.customer.creditLimit).toFixed(2)}`);
    }
    const req = await submitForApproval(tx, { companyId: session.companyId, docType: "SALES_ORDER", docId: o.id, docNumber: o.number, amount: round(D(o.total).times(o.exchangeRate), 2), requestedById: session.userId, link: `/sales/orders/${o.id}` });
    if (req) return { status: "PENDING_APPROVAL" as const };
    await tx.salesOrder.update({ where: { id }, data: { status: "CONFIRMED", updatedById: session.userId } });
    return { status: "CONFIRMED" as const };
  });
}
export async function cancelOrder(session: AppSession, id: string) {
  const o = await prisma.salesOrder.findFirst({ where: { id, companyId: session.companyId } });
  if (!o || !["DRAFT", "CONFIRMED"].includes(o.status) || !D(o.invoicedAmount).isZero()) throw new Error("INVALID_TRANSITION");
  return prisma.salesOrder.update({ where: { id }, data: { status: "CANCELLED", updatedById: session.userId } });
}
/** One click: confirmed order → draft customer invoice (remaining amount). */
export async function convertOrderToInvoice(session: AppSession, id: string) {
  const o = await getOrder(session, id);
  if (!o) throw new Error("NOT_FOUND");
  if (o.status !== "CONFIRMED" && o.status !== "PARTIALLY_INVOICED") throw new Error("INVALID_TRANSITION");
  const { saveInvoice } = await import("@/modules/finance/ar/invoices");
  const inv = await saveInvoice(session, { customerId: o.customerId, branchId: o.branchId, type: o.customer.vatNumber ? "STANDARD" : "SIMPLIFIED", kind: "INVOICE", docDate: new Date().toISOString().slice(0, 10), dueDate: new Date(Date.now() + o.customer.paymentTermsDays * 86_400_000).toISOString().slice(0, 10), currencyCode: o.currencyCode, exchangeRate: Number(o.exchangeRate), discountPct: Number(o.discountPct), reference: o.reference ?? o.number, notes: o.notes, salespersonId: o.salespersonId, lines: o.lines.map((l) => ({ itemId: l.itemId, descriptionAr: l.descriptionAr, descriptionEn: l.descriptionEn, quantity: Number(l.quantity), unitPrice: Number(l.unitPrice), discountPct: Number(l.discountPct), taxCodeId: l.taxCodeId, accountId: l.revenueAccountId, costCenterId: l.costCenterId })) });
  await prisma.customerInvoice.update({ where: { id: inv.id }, data: { sourceType: "SalesOrder", sourceId: o.id } });
  await prisma.salesOrder.update({ where: { id }, data: { status: "INVOICED", invoicedAmount: o.total, updatedById: session.userId } });
  return { id: inv.id };
}
export function orderColumns(tf: (k: string) => string, t: (k: string) => string): ColumnDef[] {
  return [
    { key: "number", label: tf("number"), sortable: true, type: "link", hrefTemplate: "/sales/orders/{id}" },
    { key: "orderDate", label: tf("date"), type: "date", sortable: true },
    { key: "customer", label: t("customer"), bilingual: "customer.name" },
    { key: "reference", label: t("customerPo") },
    { key: "deliveryDate", label: t("deliveryDate"), type: "date", sortable: true },
    { key: "total", label: t("total"), type: "money", align: "end", sortable: true, currencyPath: "currencyCode" },
    { key: "invoicedAmount", label: t("invoiced"), type: "money", align: "end", currencyPath: "currencyCode" },
    { key: "status", label: tf("status"), type: "enum", enumName: "OrderStatus", tones: { DRAFT: "secondary", CONFIRMED: "info", PARTIALLY_INVOICED: "warning", INVOICED: "success", CANCELLED: "destructive" } },
  ];
}

registerApprovalHooks("SALES_ORDER", {
  onApproved: async (tx, req) => { await tx.salesOrder.update({ where: { id: req.docId }, data: { status: "CONFIRMED" } }); },
  onRejected: async (tx, req) => { await tx.salesOrder.update({ where: { id: req.docId }, data: { status: "DRAFT" } }); },
});
DOC_LINKS.SALES_ORDER = (id) => `/sales/orders/${id}`;
DOC_LINKS.QUOTATION = (id) => `/sales/quotations/${id}`;
