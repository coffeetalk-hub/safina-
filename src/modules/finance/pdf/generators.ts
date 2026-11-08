import React from "react";
import QRCode from "qrcode";
import type { PdfGenerator } from "@/core/pdf/registry";
import { prisma } from "@/lib/prisma";
import { companyHeader } from "@/modules/foundation/settings/service";
import { PartyDocPdf, SettlementPdf, JournalPdf, type PdfPartyDoc } from "./documents";

const who = (s: { nameAr: string; nameEn: string }, locale: string) => (locale === "ar" ? s.nameAr : s.nameEn);

export const invoicePdf: PdfGenerator = {
  permission: "finance.invoice:view",
  render: async (session, id, locale) => {
    const inv = await prisma.customerInvoice.findFirst({ where: { id, companyId: session.companyId }, include: { customer: true, lines: { orderBy: { lineNo: "asc" } }, zatca: true } });
    if (!inv) return null;
    const { company, settings, logoDataUrl } = await companyHeader(session.companyId);
    const original = inv.originalId ? await prisma.customerInvoice.findUnique({ where: { id: inv.originalId }, select: { number: true } }) : null;
    const qrDataUrl = inv.zatca ? await QRCode.toDataURL(inv.zatca.qrBase64, { width: 240, margin: 0 }) : null;
    const doc: PdfPartyDoc = {
      number: inv.number, kind: inv.kind, type: inv.type, docDate: inv.invoiceDate, dueDate: inv.dueDate, supplyDate: inv.supplyDate, reference: inv.reference, originalNumber: original?.number, currencyCode: inv.currencyCode,
      party: inv.customer, lines: inv.lines.map((l) => ({ lineNo: l.lineNo, descriptionAr: l.descriptionAr, descriptionEn: l.descriptionEn, quantity: Number(l.quantity), unitPrice: Number(l.unitPrice), discountAmount: Number(l.discountAmount), net: Number(l.net), taxRate: Number(l.taxRate), tax: Number(l.tax), total: Number(l.total) })),
      subtotal: Number(inv.subtotal), discountTotal: Number(inv.discountTotal), taxTotal: Number(inv.taxTotal), total: Number(inv.total), paidAmount: Number(inv.paidAmount), notes: inv.notes, status: inv.status,
      zatca: inv.zatca ? { uuid: inv.zatca.uuid, qrDataUrl, invoiceHash: inv.zatca.invoiceHash } : null,
    };
    return { element: React.createElement(PartyDocPdf, { company: { ...company, logoDataUrl }, settings, doc, printedBy: who(session, locale) }), fileName: inv.number };
  },
};

export const billPdf: PdfGenerator = {
  permission: "finance.bill:view",
  render: async (session, id, locale) => {
    const b = await prisma.vendorBill.findFirst({ where: { id, companyId: session.companyId }, include: { vendor: true, lines: { orderBy: { lineNo: "asc" } } } });
    if (!b) return null;
    const { company, settings, logoDataUrl } = await companyHeader(session.companyId);
    const doc: PdfPartyDoc = {
      number: b.number, kind: "BILL", docDate: b.billDate, dueDate: b.dueDate, reference: b.reference, vendorInvoiceNumber: b.vendorInvoiceNumber, currencyCode: b.currencyCode, party: b.vendor,
      lines: b.lines.map((l) => ({ lineNo: l.lineNo, descriptionAr: l.descriptionAr, descriptionEn: l.descriptionEn, quantity: Number(l.quantity), unitPrice: Number(l.unitPrice), discountAmount: Number(l.discountAmount), net: Number(l.net), taxRate: Number(l.taxRate), tax: Number(l.tax), total: Number(l.total) })),
      subtotal: Number(b.subtotal), discountTotal: Number(b.discountTotal), taxTotal: Number(b.taxTotal), total: Number(b.total), paidAmount: Number(b.paidAmount), notes: b.notes, status: b.status,
    };
    return { element: React.createElement(PartyDocPdf, { company: { ...company, logoDataUrl }, settings, doc, printedBy: who(session, locale) }), fileName: b.number };
  },
};

export const receiptPdf: PdfGenerator = {
  permission: "finance.receipt:view",
  render: async (session, id, locale) => {
    const r = await prisma.receipt.findFirst({ where: { id, companyId: session.companyId }, include: { customer: true, bankAccount: true, allocations: { include: { invoice: { select: { number: true, invoiceDate: true } } } } } });
    if (!r) return null;
    const { company, logoDataUrl } = await companyHeader(session.companyId);
    return { element: React.createElement(SettlementPdf, { company: { ...company, logoDataUrl }, printedBy: who(session, locale), doc: { number: r.number, kind: "RECEIPT", date: r.receiptDate, method: r.method, bankAccount: r.bankAccount?.nameEn, currencyCode: r.currencyCode, amount: Number(r.amount), reference: r.reference, notes: r.notes, party: r.customer, status: r.status, allocations: r.allocations.map((a) => ({ number: a.invoice.number, date: a.invoice.invoiceDate, amount: Number(a.amount) })) } }), fileName: r.number };
  },
};

export const paymentPdf: PdfGenerator = {
  permission: "finance.payment:view",
  render: async (session, id, locale) => {
    const p = await prisma.payment.findFirst({ where: { id, companyId: session.companyId }, include: { vendor: true, bankAccount: true, allocations: { include: { bill: { select: { number: true, billDate: true } } } } } });
    if (!p) return null;
    const { company, logoDataUrl } = await companyHeader(session.companyId);
    return { element: React.createElement(SettlementPdf, { company: { ...company, logoDataUrl }, printedBy: who(session, locale), doc: { number: p.number, kind: "PAYMENT", date: p.paymentDate, method: p.method, bankAccount: p.bankAccount?.nameEn, currencyCode: p.currencyCode, amount: Number(p.amount), reference: p.reference, notes: p.notes, party: p.vendor, status: p.status, allocations: p.allocations.map((a) => ({ number: a.bill.number, date: a.bill.billDate, amount: Number(a.amount) })) } }), fileName: p.number };
  },
};

export const journalPdf: PdfGenerator = {
  permission: "finance.journal:view",
  render: async (session, id, locale) => {
    const j = await prisma.journalEntry.findFirst({ where: { id, companyId: session.companyId }, include: { lines: { orderBy: { lineNo: "asc" }, include: { account: true, costCenter: true } } } });
    if (!j) return null;
    const { company, logoDataUrl } = await companyHeader(session.companyId);
    return { element: React.createElement(JournalPdf, { company: { ...company, logoDataUrl }, printedBy: who(session, locale), doc: { number: j.number, entryDate: j.entryDate, description: j.description, reference: j.reference, status: j.status, source: j.source, currencyCode: j.currencyCode, totalDebit: Number(j.totalDebit), totalCredit: Number(j.totalCredit), lines: j.lines.map((l) => ({ lineNo: l.lineNo, accountCode: l.account.code, accountNameAr: l.account.nameAr, accountNameEn: l.account.nameEn, costCenter: l.costCenter?.code, description: l.description, debit: Number(l.debit), credit: Number(l.credit) })) } }), fileName: j.number };
  },
};

const partyDoc = (kind: "QUOTE" | "ORDER") => async (session: Parameters<PdfGenerator["render"]>[0], id: string, locale: string) => {
  const d = kind === "QUOTE"
    ? await prisma.quotation.findFirst({ where: { id, companyId: session.companyId }, include: { customer: true, lines: { orderBy: { lineNo: "asc" } } } })
    : await prisma.salesOrder.findFirst({ where: { id, companyId: session.companyId }, include: { customer: true, lines: { orderBy: { lineNo: "asc" } } } });
  if (!d) return null;
  const { company, settings, logoDataUrl } = await companyHeader(session.companyId);
  const docDate = "quoteDate" in d ? d.quoteDate : d.orderDate;
  const dueDate = "validUntil" in d ? d.validUntil : d.deliveryDate ?? d.orderDate;
  const doc: PdfPartyDoc = {
    number: d.number, kind, docDate, dueDate, reference: d.reference, currencyCode: d.currencyCode, party: d.customer,
    lines: d.lines.map((l) => ({ lineNo: l.lineNo, descriptionAr: l.descriptionAr, descriptionEn: l.descriptionEn, quantity: Number(l.quantity), unitPrice: Number(l.unitPrice), discountAmount: Number(l.discountAmount), net: Number(l.net), taxRate: Number(l.taxRate), tax: Number(l.tax), total: Number(l.total) })),
    subtotal: Number(d.subtotal), discountTotal: Number(d.discountTotal), taxTotal: Number(d.taxTotal), total: Number(d.total), paidAmount: 0, notes: [d.notes, "termsEn" in d ? d.termsEn : null].filter(Boolean).join("\n"), status: d.status,
  };
  return { element: React.createElement(PartyDocPdf, { company: { ...company, logoDataUrl }, settings, doc, printedBy: who(session, locale) }), fileName: d.number };
};
export const quotationPdf: PdfGenerator = { permission: "sales.quotation:view", render: partyDoc("QUOTE") };
export const salesOrderPdf: PdfGenerator = { permission: "sales.order:view", render: partyDoc("ORDER") };
