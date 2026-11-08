import React from "react";
import type { PdfGenerator } from "@/core/pdf/registry";
import { prisma } from "@/lib/prisma";
import { companyHeader } from "@/modules/foundation/settings/service";
import { PartyDocPdf, type PdfPartyDoc } from "@/modules/finance/pdf/documents";

export const purchaseOrderPdf: PdfGenerator = {
  permission: "purchasing.order:view",
  render: async (session, id, locale) => {
    const d = await prisma.purchaseOrder.findFirst({ where: { id, companyId: session.companyId }, include: { vendor: true, lines: { orderBy: { lineNo: "asc" } } } });
    if (!d) return null;
    const { company, settings, logoDataUrl } = await companyHeader(session.companyId);
    const doc: PdfPartyDoc = {
      number: d.number, kind: "PO", docDate: d.orderDate, dueDate: d.expectedDate ?? d.orderDate, reference: d.reference, currencyCode: d.currencyCode, party: d.vendor,
      lines: d.lines.map((l) => ({ lineNo: l.lineNo, descriptionAr: l.descriptionAr, descriptionEn: l.descriptionEn, quantity: Number(l.quantity), unitPrice: Number(l.unitPrice), discountAmount: Number(l.discountAmount), net: Number(l.net), taxRate: Number(l.taxRate), tax: Number(l.tax), total: Number(l.total) })),
      subtotal: Number(d.subtotal), discountTotal: Number(d.discountTotal), taxTotal: Number(d.taxTotal), total: Number(d.total), paidAmount: 0,
      notes: [d.notes, locale === "ar" ? d.termsAr : d.termsEn].filter(Boolean).join("\n"), status: d.status,
    };
    return { element: React.createElement(PartyDocPdf, { company: { ...company, logoDataUrl }, settings, doc, printedBy: locale === "ar" ? session.nameAr : session.nameEn }), fileName: d.number };
  },
};
