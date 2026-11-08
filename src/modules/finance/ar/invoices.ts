import { z } from "zod";
import { prisma, type Tx } from "@/lib/prisma";
import type { AppSession } from "@/core/auth/session";
import { orderByFrom, skipTake, type ColumnDef, type ListParams, type PagedResult } from "@/components/data-table/types";
import { nextDocumentNumber } from "@/core/numbering";
import { postJournal, reverseJournal, mappedAccount, type PostingLine } from "@/core/posting";
import { submitForApproval } from "@/core/approvals/engine";
import { registerApprovalHooks, DOC_LINKS } from "@/modules/foundation/approvals/hooks";
import { D, round, ZERO } from "@/lib/money";
import { computeDocument, docHeaderSchema, docWhere, OPEN_STATUSES } from "../_shared/docs";
import { buildUblXml, invoiceHash, buildPhase1Qr, buildPhase2Qr, getZatcaClient, newUuid, GENESIS_HASH, type ZatcaInvoice } from "@/core/zatca";

export const invoiceSchema = docHeaderSchema.extend({
  customerId: z.string().min(1),
  type: z.enum(["STANDARD", "SIMPLIFIED"]).default("STANDARD"),
  kind: z.enum(["INVOICE", "CREDIT_NOTE", "DEBIT_NOTE"]).default("INVOICE"),
  supplyDate: z.string().nullable().optional(),
  salespersonId: z.string().nullable().optional(),
  originalId: z.string().nullable().optional(),
});
export type InvoiceInput = z.infer<typeof invoiceSchema>;

export const invoiceInclude = {
  customer: true,
  lines: { orderBy: { lineNo: "asc" as const }, include: { taxCode: { select: { code: true, category: true } } } },
  zatca: { select: { uuid: true, icv: true, invoiceHash: true, qrBase64: true, status: true, submittedAt: true, response: true } },
  allocations: { include: { receipt: { select: { id: true, number: true, receiptDate: true } } } },
};

export async function listInvoices(session: AppSession, p: ListParams): Promise<PagedResult<Record<string, unknown>>> {
  const w = docWhere(session, p, "customerId", "invoiceDate");
  if (p.filters.overdue === "true") Object.assign(w, { status: { in: [...OPEN_STATUSES] }, dueDate: { lt: new Date() } });
  const [rows, total] = await Promise.all([
    prisma.customerInvoice.findMany({ where: w, orderBy: orderByFrom(p.sort, ["number", "invoiceDate", "dueDate", "total", "status"], { invoiceDate: "desc" }), ...skipTake(p), include: { customer: { select: { code: true, nameAr: true, nameEn: true } } } }),
    prisma.customerInvoice.count({ where: w }),
  ]);
  return { rows: rows.map((r) => ({ ...r, outstanding: D(r.total).minus(r.paidAmount) })), total, page: p.page, pageSize: p.pageSize };
}
export async function allInvoices(session: AppSession, p: ListParams) {
  const rows = await prisma.customerInvoice.findMany({ where: docWhere(session, p, "customerId", "invoiceDate"), orderBy: { invoiceDate: "desc" }, take: 10_000, include: { customer: { select: { code: true, nameAr: true, nameEn: true } } } });
  return rows.map((r) => ({ ...r, outstanding: D(r.total).minus(r.paidAmount) }));
}
export async function getInvoice(session: AppSession, id: string) {
  return prisma.customerInvoice.findFirst({ where: { id, companyId: session.companyId }, include: invoiceInclude });
}

/** Create/update a draft invoice. */
export async function saveInvoice(session: AppSession, input: InvoiceInput) {
  const customer = await prisma.customer.findFirst({ where: { id: input.customerId, companyId: session.companyId } });
  if (!customer) throw new Error("NOT_FOUND");
  const { computed, subtotal, discountTotal, taxTotal, total } = await computeDocument(prisma, session.companyId, input.lines, input.discountPct);
  const rate = input.currencyCode === "SAR" ? D(1) : D(input.exchangeRate);
  const invoiceDate = new Date(input.docDate);
  const data = {
    branchId: input.branchId || null,
    customerId: input.customerId,
    type: input.type,
    kind: input.kind,
    invoiceDate,
    dueDate: new Date(input.dueDate),
    supplyDate: input.supplyDate ? new Date(input.supplyDate) : null,
    currencyCode: input.currencyCode,
    exchangeRate: rate,
    subtotal,
    discountTotal,
    discountPct: input.discountPct,
    taxTotal,
    total,
    baseTotal: round(total.times(rate), 2),
    reference: input.reference ?? null,
    notes: input.notes ?? null,
    salespersonId: input.salespersonId || null,
    originalId: input.originalId || null,
  };
  const lineData = input.lines.map((l, i) => ({ lineNo: i + 1, itemId: l.itemId || null, descriptionAr: l.descriptionAr, descriptionEn: l.descriptionEn, quantity: l.quantity, unitPrice: l.unitPrice, discountPct: l.discountPct, discountAmount: computed[i].discountAmount, taxCodeId: l.taxCodeId || null, taxRate: computed[i].taxRate, net: computed[i].net, tax: computed[i].tax, total: computed[i].total, revenueAccountId: l.accountId || null, costCenterId: l.costCenterId || null }));
  return prisma.$transaction(async (tx) => {
    if (input.id) {
      const ex = await tx.customerInvoice.findFirst({ where: { id: input.id, companyId: session.companyId } });
      if (!ex) throw new Error("NOT_FOUND");
      if (ex.status !== "DRAFT") throw new Error("NOT_DRAFT");
      await tx.invoiceLine.deleteMany({ where: { invoiceId: input.id } });
      return tx.customerInvoice.update({ where: { id: input.id }, data: { ...data, updatedById: session.userId, lines: { create: lineData } } });
    }
    const number = await nextDocumentNumber(tx, session.companyId, input.kind === "CREDIT_NOTE" ? "CREDIT_NOTE" : "INVOICE", invoiceDate);
    return tx.customerInvoice.create({ data: { ...data, companyId: session.companyId, number, status: "DRAFT", createdById: session.userId, lines: { create: lineData } } });
  });
}

/** Customer outstanding balance (posted invoices − payments). */
export async function customerOutstanding(companyId: string, customerId: string) {
  const r = await prisma.customerInvoice.aggregate({ where: { companyId, customerId, status: { in: [...OPEN_STATUSES] } }, _sum: { baseTotal: true, paidAmount: true } });
  return D(r._sum.baseTotal ?? 0).minus(D(r._sum.paidAmount ?? 0));
}

/** Posts the invoice: GL entry + ZATCA document. Honours approval policies and credit limits. */
export async function postInvoice(session: AppSession, id: string, opts: { overrideCredit?: boolean } = {}) {
  return prisma.$transaction(async (tx) => {
    const inv = await tx.customerInvoice.findFirst({ where: { id, companyId: session.companyId }, include: { lines: { include: { item: true, taxCode: true } }, customer: true } });
    if (!inv) throw new Error("NOT_FOUND");
    if (inv.status !== "DRAFT" && inv.status !== "APPROVED") throw new Error("NOT_DRAFT");
    if (inv.status === "DRAFT") {
      const req = await submitForApproval(tx, { companyId: session.companyId, docType: "INVOICE", docId: inv.id, docNumber: inv.number, amount: inv.baseTotal, requestedById: session.userId, link: `/finance/ar/invoices/${inv.id}` });
      if (req) {
        await tx.customerInvoice.update({ where: { id }, data: { status: "PENDING_APPROVAL" } });
        return { status: "PENDING_APPROVAL" as const };
      }
    }
    if (inv.kind !== "CREDIT_NOTE" && inv.customer.blockOnCreditExceed && D(inv.customer.creditLimit).gt(0) && !opts.overrideCredit) {
      const outstanding = await customerOutstanding(session.companyId, inv.customerId);
      if (outstanding.plus(inv.baseTotal).gt(inv.customer.creditLimit)) throw new Error(`CREDIT_LIMIT_EXCEEDED:${outstanding.plus(inv.baseTotal).minus(inv.customer.creditLimit).toFixed(2)}`);
    }
    await postInvoiceTx(tx, session.userId, inv.id);
    return { status: "POSTED" as const };
  });
}

/** Internal: GL + ZATCA for an invoice that is cleared to post. */
export async function postInvoiceTx(tx: Tx, userId: string, id: string) {
  const inv = await tx.customerInvoice.findFirstOrThrow({ where: { id }, include: { lines: { include: { item: true, taxCode: true } }, customer: true } });
  const companyId = inv.companyId;
  const ar = inv.customer.receivableAccountId ?? (await mappedAccount(tx, companyId, "AR"));
  const vatOut = await mappedAccount(tx, companyId, "VAT_OUTPUT");
  const defaultRevenue = await mappedAccount(tx, companyId, "SALES_REVENUE");
  const credit = inv.kind === "CREDIT_NOTE";
  const lines: PostingLine[] = [];
  const dr = (l: Omit<PostingLine, "debit" | "credit">, amt: ReturnType<typeof D>) => lines.push({ ...l, ...(credit ? { credit: amt } : { debit: amt }) });
  const cr = (l: Omit<PostingLine, "debit" | "credit">, amt: ReturnType<typeof D>) => lines.push({ ...l, ...(credit ? { debit: amt } : { credit: amt }) });
  dr({ accountId: ar, description: `${inv.number} ${inv.customer.nameEn}`, partyType: "CUSTOMER", partyId: inv.customerId }, D(inv.total));
  for (const l of inv.lines) {
    const revenue = l.revenueAccountId ?? l.item?.revenueAccountId ?? defaultRevenue;
    if (!D(l.net).isZero()) cr({ accountId: revenue, costCenterId: l.costCenterId, description: l.descriptionEn }, D(l.net));
    if (!D(l.tax).isZero()) cr({ accountId: vatOut, costCenterId: l.costCenterId, description: `VAT ${l.taxCode?.code ?? ""}`, taxCodeId: l.taxCodeId, taxBase: l.net }, D(l.tax));
  }
  // zero-rated / exempt lines still need taxBase for VAT return: record on revenue line
  for (const l of inv.lines) if (D(l.tax).isZero() && l.taxCodeId) {
    const idx = lines.findIndex((x) => x.description === l.descriptionEn && x.taxBase === undefined);
    if (idx >= 0) { lines[idx].taxCodeId = l.taxCodeId; lines[idx].taxBase = l.net; }
  }
  const entry = await postJournal(tx, { companyId, branchId: inv.branchId, entryDate: inv.invoiceDate, description: `${credit ? "Credit note" : "Invoice"} ${inv.number} — ${inv.customer.nameEn}`, reference: inv.number, source: "AR_INVOICE", sourceType: "CustomerInvoice", sourceId: inv.id, currencyCode: inv.currencyCode, exchangeRate: inv.exchangeRate, lines, userId });
  await tx.customerInvoice.update({ where: { id }, data: { status: "POSTED", journalEntryId: entry.id, updatedById: userId } });
  await generateZatca(tx, inv.id);
  // credit note auto-applies to the original invoice
  if (credit && inv.originalId) {
    const orig = await tx.customerInvoice.findFirst({ where: { id: inv.originalId, companyId } });
    if (orig && OPEN_STATUSES.includes(orig.status as "POSTED")) {
      const apply = D(inv.total).lt(D(orig.total).minus(orig.paidAmount)) ? D(inv.total) : D(orig.total).minus(orig.paidAmount);
      const paid = D(orig.paidAmount).plus(apply);
      await tx.customerInvoice.update({ where: { id: orig.id }, data: { paidAmount: paid, status: paid.gte(orig.total) ? "PAID" : "PARTIALLY_PAID" } });
      await tx.customerInvoice.update({ where: { id }, data: { paidAmount: apply, status: apply.gte(inv.total) ? "PAID" : "PARTIALLY_PAID" } });
    }
  }
}

/** Builds UUID/ICV/PIH/hash/QR/XML and stores the ZatcaDocument. */
export async function generateZatca(tx: Tx, invoiceId: string) {
  const inv = await tx.customerInvoice.findFirstOrThrow({ where: { id: invoiceId }, include: { lines: { include: { taxCode: true, item: true } }, customer: true } });
  const company = await tx.company.findUniqueOrThrow({ where: { id: inv.companyId } });
  if (!company.vatNumber) throw new Error("COMPANY_VAT_REQUIRED");
  const last = await tx.zatcaDocument.findFirst({ where: { companyId: inv.companyId }, orderBy: { icv: "desc" } });
  const icv = (last?.icv ?? 0) + 1;
  const previousHash = last?.invoiceHash ?? GENESIS_HASH;
  const original = inv.originalId ? await tx.customerInvoice.findUnique({ where: { id: inv.originalId }, select: { number: true } }) : null;
  const cat = (c?: string | null): "S" | "Z" | "E" | "O" => (c === "ZERO_RATED" ? "Z" : c === "EXEMPT" ? "E" : c === "OUT_OF_SCOPE" ? "O" : "S");
  const z: ZatcaInvoice = {
    number: inv.number,
    uuid: newUuid(),
    issueDate: new Date(),
    supplyDate: inv.supplyDate,
    type: inv.type,
    kind: inv.kind,
    originalNumber: original?.number ?? null,
    reason: inv.kind !== "INVOICE" ? inv.notes ?? "Adjustment" : null,
    currency: inv.currencyCode,
    icv,
    previousHash,
    seller: { nameAr: company.nameAr, nameEn: company.nameEn, vatNumber: company.vatNumber, crNumber: company.crNumber, street: company.addressEn, buildingNo: company.buildingNo, district: company.district, city: company.city, postalCode: company.postalCode, country: company.country },
    buyer: inv.type === "STANDARD" ? { name: inv.customer.nameEn, vatNumber: inv.customer.vatNumber, crNumber: inv.customer.crNumber, street: inv.customer.addressEn, buildingNo: inv.customer.buildingNo, district: inv.customer.district, city: inv.customer.city, postalCode: inv.customer.postalCode, country: inv.customer.country } : null,
    lines: inv.lines.map((l) => ({ id: l.lineNo, name: l.descriptionAr, quantity: Number(l.quantity), unit: l.item?.unit, unitPrice: Number(l.unitPrice), net: Number(l.net), discount: Number(l.discountAmount), taxRate: Number(l.taxRate), taxAmount: Number(l.tax), total: Number(l.total), taxCategory: cat(l.taxCode?.category) })),
    subtotal: Number(inv.subtotal) - Number(inv.discountTotal) + 0,
    discountTotal: 0, // discounts already applied at line level (LineExtensionAmount is net)
    taxTotal: Number(inv.taxTotal),
    total: Number(inv.total),
  };
  const xml = buildUblXml(z);
  const hash = invoiceHash(xml);
  const client = getZatcaClient();
  const signing = await client.sign(xml, hash);
  // Without a real signing key, print the Phase 1 QR rather than placeholder signature data.
  const qr = client.mode === "STUB" ? buildPhase1Qr(z) : buildPhase2Qr(z, hash, signing);
  await tx.zatcaDocument.upsert({
    where: { invoiceId },
    create: { invoiceId, companyId: inv.companyId, uuid: z.uuid, icv, previousHash, invoiceHash: hash, qrBase64: qr, xml: signing.signedXml },
    update: { uuid: z.uuid, icv, previousHash, invoiceHash: hash, qrBase64: qr, xml: signing.signedXml },
  });
}

/** Sends the stored XML to ZATCA via the configured client (stub by default). */
export async function submitToZatca(session: AppSession, invoiceId: string) {
  const doc = await prisma.zatcaDocument.findFirst({ where: { invoiceId, companyId: session.companyId }, include: { invoice: { select: { type: true } } } });
  if (!doc) throw new Error("NOT_FOUND");
  const client = getZatcaClient();
  const payload = { uuid: doc.uuid, hash: doc.invoiceHash, signedXml: doc.xml };
  const res = doc.invoice.type === "SIMPLIFIED" ? await client.reportSimplified(payload) : await client.clearStandard(payload);
  await prisma.zatcaDocument.update({ where: { id: doc.id }, data: { status: res.status, submittedAt: new Date(), response: res.response as object } });
  return res;
}

export async function cancelInvoice(session: AppSession, id: string) {
  const inv = await prisma.customerInvoice.findFirst({ where: { id, companyId: session.companyId } });
  if (!inv) throw new Error("NOT_FOUND");
  if (inv.status !== "DRAFT" && inv.status !== "PENDING_APPROVAL") throw new Error("NOT_DRAFT");
  await prisma.approvalRequest.updateMany({ where: { docType: "INVOICE", docId: id, status: "PENDING" }, data: { status: "CANCELLED" } });
  return prisma.customerInvoice.update({ where: { id }, data: { status: "CANCELLED", updatedById: session.userId } });
}

/** Reverses a posted, unpaid invoice (GL reversal + status). Paid invoices need a credit note. */
export async function reverseInvoice(session: AppSession, id: string) {
  return prisma.$transaction(async (tx) => {
    const inv = await tx.customerInvoice.findFirst({ where: { id, companyId: session.companyId } });
    if (!inv) throw new Error("NOT_FOUND");
    if (inv.status !== "POSTED" || !D(inv.paidAmount).isZero()) throw new Error("HAS_PAYMENTS");
    if (inv.journalEntryId) await reverseJournal(tx, session.companyId, inv.journalEntryId, session.userId);
    return tx.customerInvoice.update({ where: { id }, data: { status: "REVERSED", updatedById: session.userId } });
  });
}

/** Create a draft credit note from a posted invoice (full). */
export async function createCreditNote(session: AppSession, invoiceId: string) {
  const inv = await getInvoice(session, invoiceId);
  if (!inv) throw new Error("NOT_FOUND");
  return saveInvoice(session, {
    customerId: inv.customerId,
    branchId: inv.branchId,
    type: inv.type,
    kind: "CREDIT_NOTE",
    docDate: new Date().toISOString().slice(0, 10),
    dueDate: new Date().toISOString().slice(0, 10),
    currencyCode: inv.currencyCode,
    exchangeRate: Number(inv.exchangeRate),
    discountPct: Number(inv.discountPct),
    reference: inv.number,
    notes: `Credit note for ${inv.number}`,
    salespersonId: inv.salespersonId,
    originalId: inv.id,
    lines: inv.lines.map((l) => ({ itemId: l.itemId, descriptionAr: l.descriptionAr, descriptionEn: l.descriptionEn, quantity: Number(l.quantity), unitPrice: Number(l.unitPrice), discountPct: Number(l.discountPct), taxCodeId: l.taxCodeId, accountId: l.revenueAccountId, costCenterId: l.costCenterId })),
  });
}

export function invoiceColumns(tf: (k: string) => string, t: (k: string) => string): ColumnDef[] {
  return [
    { key: "number", label: tf("number"), sortable: true, type: "link", hrefTemplate: "/finance/ar/invoices/{id}" },
    { key: "invoiceDate", label: tf("date"), type: "date", sortable: true },
    { key: "customer", label: t("customer"), bilingual: "customer.name" },
    { key: "kind", label: tf("type"), type: "enum", enumName: "InvoiceKind" },
    { key: "type", label: t("invoiceType"), type: "enum", enumName: "InvoiceType", hidden: true },
    { key: "dueDate", label: t("dueDate"), type: "date", sortable: true },
    { key: "total", label: tc("total"), type: "money", align: "end", sortable: true, currencyPath: "currencyCode" },
    { key: "paidAmount", label: t("paid"), type: "money", align: "end", currencyPath: "currencyCode" },
    { key: "outstanding", label: t("outstanding"), type: "money", align: "end", currencyPath: "currencyCode" },
    { key: "status", label: tf("status"), type: "enum", enumName: "DocStatus", tones: { DRAFT: "secondary", PENDING_APPROVAL: "warning", APPROVED: "info", POSTED: "info", PARTIALLY_PAID: "warning", PAID: "success", CANCELLED: "destructive", REVERSED: "destructive" } },
    { key: "zatcaStatus", label: "ZATCA", path: "zatca.status", hidden: true },
  ];
  function tc(k: string) {
    return k === "total" ? t("total") : k;
  }
}

/** AR aging as of a date, grouped by customer. */
export async function arAging(session: AppSession, asOf: Date, customerId?: string) {
  const rows = await prisma.customerInvoice.findMany({ where: { companyId: session.companyId, status: { in: [...OPEN_STATUSES] }, invoiceDate: { lte: asOf }, customerId: customerId || undefined }, include: { customer: { select: { id: true, code: true, nameAr: true, nameEn: true } } } });
  const { agingBuckets } = await import("../_shared/docs");
  const byCustomer = new Map<string, Record<string, unknown> & { current: number; d1_30: number; d31_60: number; d61_90: number; d90plus: number; total: number }>();
  for (const r of rows) {
    const out = D(r.baseTotal).minus(r.paidAmount).toNumber();
    if (out <= 0) continue;
    const b = agingBuckets(asOf, r.dueDate, out);
    const c = byCustomer.get(r.customerId) ?? { id: r.customerId, code: r.customer.code, nameAr: r.customer.nameAr, nameEn: r.customer.nameEn, current: 0, d1_30: 0, d31_60: 0, d61_90: 0, d90plus: 0, total: 0 };
    c.current += b.current; c.d1_30 += b.d1_30; c.d31_60 += b.d31_60; c.d61_90 += b.d61_90; c.d90plus += b.d90plus; c.total += out;
    byCustomer.set(r.customerId, c);
  }
  return [...byCustomer.values()].sort((a, b) => b.total - a.total);
}

/** Customer statement: invoices and receipts with running balance. */
export async function customerStatement(session: AppSession, customerId: string, from: Date, to: Date) {
  const [invoices, receipts, opening] = await Promise.all([
    prisma.customerInvoice.findMany({ where: { companyId: session.companyId, customerId, status: { in: ["POSTED", "PARTIALLY_PAID", "PAID"] }, invoiceDate: { gte: from, lte: to } }, orderBy: { invoiceDate: "asc" } }),
    prisma.receipt.findMany({ where: { companyId: session.companyId, customerId, status: "POSTED", receiptDate: { gte: from, lte: to } }, orderBy: { receiptDate: "asc" } }),
    (async () => {
      const inv = await prisma.customerInvoice.aggregate({ where: { companyId: session.companyId, customerId, status: { in: ["POSTED", "PARTIALLY_PAID", "PAID"] }, invoiceDate: { lt: from } }, _sum: { baseTotal: true } });
      const rc = await prisma.receipt.aggregate({ where: { companyId: session.companyId, customerId, status: "POSTED", receiptDate: { lt: from } }, _sum: { baseAmount: true } });
      const cn = await prisma.customerInvoice.aggregate({ where: { companyId: session.companyId, customerId, kind: "CREDIT_NOTE", status: { in: ["POSTED", "PARTIALLY_PAID", "PAID"] }, invoiceDate: { lt: from } }, _sum: { baseTotal: true } });
      return D(inv._sum.baseTotal ?? 0).minus(D(rc._sum.baseAmount ?? 0)).minus(D(cn._sum.baseTotal ?? 0).times(2)).toNumber();
    })(),
  ]);
  type Row = { id: string; date: Date; type: string; number: string; debit: number; credit: number; balance: number };
  const rows: Row[] = [
    ...invoices.map((i) => ({ id: i.id, date: i.invoiceDate, type: i.kind, number: i.number, debit: i.kind === "CREDIT_NOTE" ? 0 : Number(i.baseTotal), credit: i.kind === "CREDIT_NOTE" ? Number(i.baseTotal) : 0, balance: 0 })),
    ...receipts.map((r) => ({ id: r.id, date: r.receiptDate, type: "RECEIPT", number: r.number, debit: 0, credit: Number(r.baseAmount), balance: 0 })),
  ].sort((a, b) => a.date.getTime() - b.date.getTime());
  let bal = opening;
  for (const r of rows) {
    bal += r.debit - r.credit;
    r.balance = bal;
  }
  return { opening, rows, closing: bal };
}

// Approval hook: when the approval request is approved, post the invoice.
registerApprovalHooks("INVOICE", {
  onApproved: async (tx, req) => {
    await tx.customerInvoice.update({ where: { id: req.docId }, data: { status: "APPROVED" } });
    const inv = await tx.customerInvoice.findUnique({ where: { id: req.docId } });
    if (inv) await postInvoiceTx(tx, inv.updatedById ?? inv.createdById ?? "system", inv.id);
  },
  onRejected: async (tx, req) => {
    await tx.customerInvoice.update({ where: { id: req.docId }, data: { status: "DRAFT" } });
  },
});
DOC_LINKS.INVOICE = (id) => `/finance/ar/invoices/${id}`;
DOC_LINKS.CREDIT_NOTE = (id) => `/finance/ar/invoices/${id}`;

export { ZERO };
