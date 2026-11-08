import { z } from "zod";
import { prisma } from "@/lib/prisma";
import type { AppSession } from "@/core/auth/session";
import { orderByFrom, skipTake, type ColumnDef, type ListParams, type PagedResult } from "@/components/data-table/types";
import { nextDocumentNumber } from "@/core/numbering";
import { D } from "@/lib/money";
import { notify } from "@/core/notifications";

export const rfqSchema = z.object({
  id: z.string().nullable().optional(),
  titleAr: z.string().min(1).max(200), titleEn: z.string().min(1).max(200),
  requestId: z.string().nullable().optional(), branchId: z.string().nullable().optional(),
  issueDate: z.string().min(10), dueDate: z.string().min(10), notes: z.string().max(2000).nullable().optional(),
  vendorIds: z.array(z.string()).min(1),
  lines: z.array(z.object({ id: z.string().nullable().optional(), itemId: z.string().nullable().optional(), descriptionAr: z.string().min(1), descriptionEn: z.string().min(1), quantity: z.coerce.number().positive().default(1), unit: z.string().max(10).default("EA") })).min(1),
});
export const quoteSchema = z.object({
  rfqId: z.string(), vendorId: z.string(),
  quoteRef: z.string().max(60).nullable().optional(), quoteDate: z.string().nullable().optional(), validUntil: z.string().nullable().optional(),
  leadDays: z.coerce.number().int().min(0).nullable().optional(), paymentTerms: z.string().max(120).nullable().optional(), currencyCode: z.string().length(3).default("SAR"), notes: z.string().max(1000).nullable().optional(),
  lines: z.array(z.object({ rfqLineId: z.string(), unitPrice: z.coerce.number().min(0), notes: z.string().max(200).nullable().optional() })),
});

const include = { lines: { orderBy: { lineNo: "asc" as const } }, quotes: { include: { vendor: { select: { id: true, code: true, nameAr: true, nameEn: true } }, lines: true } }, request: { select: { id: true, number: true } } };

function where(session: AppSession, p: ListParams) {
  const w: Record<string, unknown> = { companyId: session.companyId };
  if (p.q) w.OR = [{ number: { contains: p.q, mode: "insensitive" } }, { titleAr: { contains: p.q, mode: "insensitive" } }, { titleEn: { contains: p.q, mode: "insensitive" } }];
  if (p.filters.status) w.status = p.filters.status;
  return w;
}
export async function listRfqs(session: AppSession, p: ListParams): Promise<PagedResult<Record<string, unknown>>> {
  const w = where(session, p);
  const [rows, total] = await Promise.all([prisma.rfq.findMany({ where: w, orderBy: orderByFrom(p.sort, ["number", "issueDate", "dueDate", "status"], { issueDate: "desc" }), ...skipTake(p), include: { _count: { select: { quotes: true, lines: true } }, request: { select: { number: true } } } }), prisma.rfq.count({ where: w })]);
  return { rows: rows.map((r) => ({ ...r, vendorsCount: r._count.quotes, linesCount: r._count.lines, requestNumber: r.request?.number ?? "" })), total, page: p.page, pageSize: p.pageSize };
}
export async function allRfqs(session: AppSession, p: ListParams) { return (await prisma.rfq.findMany({ where: where(session, p), orderBy: { issueDate: "desc" }, take: 10_000, include: { _count: { select: { quotes: true, lines: true } }, request: { select: { number: true } } } })).map((r) => ({ ...r, vendorsCount: r._count.quotes, linesCount: r._count.lines, requestNumber: r.request?.number ?? "" })); }
export async function getRfq(session: AppSession, id: string) { return prisma.rfq.findFirst({ where: { id, companyId: session.companyId }, include }); }

export async function saveRfq(session: AppSession, input: z.infer<typeof rfqSchema>) {
  const vendors = await prisma.vendor.findMany({ where: { id: { in: input.vendorIds }, companyId: session.companyId }, select: { id: true } });
  const data = { titleAr: input.titleAr, titleEn: input.titleEn, requestId: input.requestId || null, branchId: input.branchId || null, issueDate: new Date(input.issueDate), dueDate: new Date(input.dueDate), notes: input.notes ?? null };
  return prisma.$transaction(async (tx) => {
    const rfqId = input.id ?? null;
    if (rfqId) {
      const ex = await tx.rfq.findFirst({ where: { id: rfqId, companyId: session.companyId } });
      if (!ex) throw new Error("NOT_FOUND");
      if (ex.status === "AWARDED" || ex.status === "CANCELLED") throw new Error("INVALID_TRANSITION");
      await tx.rfq.update({ where: { id: rfqId }, data: { ...data, updatedById: session.userId } });
      // lines: upsert by id, delete removed
      const keep = input.lines.filter((l) => l.id).map((l) => l.id!);
      await tx.rfqLine.deleteMany({ where: { rfqId, id: { notIn: keep } } });
      for (const [i, l] of input.lines.entries()) {
        const d = { lineNo: i + 1, itemId: l.itemId || null, descriptionAr: l.descriptionAr, descriptionEn: l.descriptionEn, quantity: l.quantity, unit: l.unit };
        if (l.id) await tx.rfqLine.update({ where: { id: l.id }, data: d }); else await tx.rfqLine.create({ data: { ...d, rfqId } });
      }
      await tx.rfqVendorQuote.deleteMany({ where: { rfqId, vendorId: { notIn: vendors.map((v) => v.id) }, received: false } });
      for (const v of vendors) await tx.rfqVendorQuote.upsert({ where: { rfqId_vendorId: { rfqId, vendorId: v.id } }, create: { rfqId, vendorId: v.id }, update: {} });
      return { id: rfqId };
    }
    const number = await nextDocumentNumber(tx, session.companyId, "RFQ", data.issueDate);
    const r = await tx.rfq.create({ data: { ...data, companyId: session.companyId, number, createdById: session.userId, lines: { create: input.lines.map((l, i) => ({ lineNo: i + 1, itemId: l.itemId || null, descriptionAr: l.descriptionAr, descriptionEn: l.descriptionEn, quantity: l.quantity, unit: l.unit })) }, quotes: { create: vendors.map((v) => ({ vendorId: v.id })) } } });
    if (data.requestId) await tx.purchaseRequest.update({ where: { id: data.requestId }, data: { status: "RFQ" } });
    return { id: r.id };
  });
}
/** Create an RFQ pre-filled from an approved purchase request. */
export async function rfqFromRequest(session: AppSession, requestId: string, vendorIds: string[]) {
  const pr = await prisma.purchaseRequest.findFirst({ where: { id: requestId, companyId: session.companyId }, include: { lines: true } });
  if (!pr) throw new Error("NOT_FOUND");
  if (pr.status !== "APPROVED") throw new Error("INVALID_TRANSITION");
  const due = new Date(); due.setUTCDate(due.getUTCDate() + 7);
  return saveRfq(session, { titleAr: pr.purpose ?? `طلب عروض ${pr.number}`, titleEn: pr.purpose ?? `RFQ for ${pr.number}`, requestId: pr.id, branchId: pr.branchId, issueDate: new Date().toISOString().slice(0, 10), dueDate: due.toISOString().slice(0, 10), vendorIds, lines: pr.lines.map((l) => ({ itemId: l.itemId, descriptionAr: l.descriptionAr, descriptionEn: l.descriptionEn, quantity: Number(l.quantity), unit: l.unit })) });
}
export async function setRfqStatus(session: AppSession, id: string, status: "SENT" | "CANCELLED" | "DRAFT") {
  const r = await prisma.rfq.findFirst({ where: { id, companyId: session.companyId } });
  if (!r || r.status === "AWARDED") throw new Error("INVALID_TRANSITION");
  return prisma.rfq.update({ where: { id }, data: { status, updatedById: session.userId } });
}
/** Record a vendor's quote (prices per RFQ line). */
export async function saveQuote(session: AppSession, input: z.infer<typeof quoteSchema>) {
  const rfq = await prisma.rfq.findFirst({ where: { id: input.rfqId, companyId: session.companyId }, include: { lines: true } });
  if (!rfq) throw new Error("NOT_FOUND");
  if (rfq.status === "AWARDED" || rfq.status === "CANCELLED") throw new Error("INVALID_TRANSITION");
  const total = input.lines.reduce((a, l) => { const line = rfq.lines.find((x) => x.id === l.rfqLineId); return a.plus(D(l.unitPrice).times(line?.quantity ?? 0)); }, D(0));
  return prisma.$transaction(async (tx) => {
    const q = await tx.rfqVendorQuote.upsert({ where: { rfqId_vendorId: { rfqId: input.rfqId, vendorId: input.vendorId } }, create: { rfqId: input.rfqId, vendorId: input.vendorId }, update: {} });
    await tx.rfqVendorQuote.update({ where: { id: q.id }, data: { quoteRef: input.quoteRef ?? null, quoteDate: input.quoteDate ? new Date(input.quoteDate) : null, validUntil: input.validUntil ? new Date(input.validUntil) : null, leadDays: input.leadDays ?? null, paymentTerms: input.paymentTerms ?? null, currencyCode: input.currencyCode, notes: input.notes ?? null, total, received: true } });
    await tx.rfqQuoteLine.deleteMany({ where: { quoteId: q.id } });
    await tx.rfqQuoteLine.createMany({ data: input.lines.map((l) => ({ quoteId: q.id, rfqLineId: l.rfqLineId, unitPrice: l.unitPrice, notes: l.notes ?? null })) });
    const received = await tx.rfqVendorQuote.count({ where: { rfqId: input.rfqId, received: true } });
    if (received > 0 && rfq.status !== "QUOTED") await tx.rfq.update({ where: { id: input.rfqId }, data: { status: "QUOTED" } });
    return { id: q.id };
  });
}
/** Comparison matrix: per line, each vendor's price; lowest flagged; vendor totals and rank. */
export function compare(rfq: NonNullable<Awaited<ReturnType<typeof getRfq>>>) {
  const vendors = rfq.quotes.filter((q) => q.received);
  const rows = rfq.lines.map((l) => {
    const prices = vendors.map((v) => { const ql = v.lines.find((x) => x.rfqLineId === l.id); return { vendorId: v.vendorId, unitPrice: ql ? Number(ql.unitPrice) : null, total: ql ? Number(ql.unitPrice) * Number(l.quantity) : null }; });
    const valid = prices.filter((p) => p.unitPrice != null && p.unitPrice > 0).map((p) => p.unitPrice as number);
    const min = valid.length ? Math.min(...valid) : null;
    return { lineId: l.id, lineNo: l.lineNo, descriptionAr: l.descriptionAr, descriptionEn: l.descriptionEn, quantity: Number(l.quantity), unit: l.unit, prices, min };
  });
  const totals = vendors.map((v) => ({ vendorId: v.vendorId, vendor: v.vendor, total: Number(v.total), leadDays: v.leadDays, paymentTerms: v.paymentTerms, validUntil: v.validUntil, quoteRef: v.quoteRef, selected: v.selected, lowestLines: rows.filter((r) => r.min != null && r.prices.find((p) => p.vendorId === v.vendorId)?.unitPrice === r.min).length }));
  const ranked = [...totals].filter((t) => t.total > 0).sort((a, b) => a.total - b.total);
  return { rows, totals: totals.map((t) => ({ ...t, rank: ranked.findIndex((r) => r.vendorId === t.vendorId) + 1 || null })) };
}
/** Award to a vendor → draft purchase order from their quote. */
export async function awardRfq(session: AppSession, rfqId: string, vendorId: string) {
  const rfq = await getRfq(session, rfqId);
  if (!rfq) throw new Error("NOT_FOUND");
  if (rfq.status === "AWARDED") throw new Error("INVALID_TRANSITION");
  const quote = rfq.quotes.find((q) => q.vendorId === vendorId && q.received);
  if (!quote) throw new Error("QUOTE_NOT_RECEIVED");
  const { savePurchaseOrder } = await import("./orders");
  const vat = await prisma.taxCode.findFirst({ where: { companyId: session.companyId, isDefault: true } });
  const po = await savePurchaseOrder(session, { vendorId, branchId: rfq.branchId, requestId: rfq.requestId, rfqId: rfq.id, docDate: new Date().toISOString().slice(0, 10), dueDate: quote.leadDays != null ? new Date(Date.now() + quote.leadDays * 86_400_000).toISOString().slice(0, 10) : null, currencyCode: quote.currencyCode, exchangeRate: 1, discountPct: 0, reference: quote.quoteRef, notes: rfq.notes, lines: rfq.lines.map((l) => { const ql = quote.lines.find((x) => x.rfqLineId === l.id); return { itemId: l.itemId, descriptionAr: l.descriptionAr, descriptionEn: l.descriptionEn, quantity: Number(l.quantity), unitPrice: Number(ql?.unitPrice ?? 0), discountPct: 0, taxCodeId: vat?.id ?? null, accountId: null, costCenterId: null }; }) });
  await prisma.$transaction([
    prisma.rfqVendorQuote.updateMany({ where: { rfqId }, data: { selected: false } }),
    prisma.rfqVendorQuote.update({ where: { id: quote.id }, data: { selected: true } }),
    prisma.rfq.update({ where: { id: rfqId }, data: { status: "AWARDED", awardedVendorId: vendorId, purchaseOrderId: po.id, updatedById: session.userId } }),
  ]);
  if (rfq.requestId) await prisma.purchaseRequest.update({ where: { id: rfq.requestId }, data: { status: "ORDERED" } });
  await notify(prisma, { companyId: session.companyId, userId: session.userId, type: "RFQ_AWARDED", titleAr: `تمت ترسية ${rfq.number}`, titleEn: `${rfq.number} awarded`, link: `/purchasing/orders/${po.id}`, entityType: "PurchaseOrder", entityId: po.id });
  return { id: po.id };
}
export function rfqColumns(tf: (k: string) => string, t: (k: string) => string): ColumnDef[] {
  return [
    { key: "number", label: tf("number"), sortable: true, type: "link", hrefTemplate: "/purchasing/rfq/{id}" },
    { key: "title", label: tf("title"), bilingual: "title" },
    { key: "requestNumber", label: t("request") },
    { key: "issueDate", label: tf("date"), type: "date", sortable: true },
    { key: "dueDate", label: t("quotesDue"), type: "date", sortable: true },
    { key: "vendorsCount", label: t("vendorsInvited"), type: "number", align: "center" },
    { key: "linesCount", label: t("lines"), type: "number", align: "center" },
    { key: "status", label: tf("status"), type: "enum", enumName: "RfqStatus", tones: { DRAFT: "secondary", SENT: "info", QUOTED: "warning", AWARDED: "success", CANCELLED: "destructive" } },
  ];
}
