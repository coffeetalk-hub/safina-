import React from "react";
import { Text, View, Image } from "@react-pdf/renderer";
import { PdfFrame, pdfStyles, type PdfCompany } from "@/core/pdf/base";
import type { CompanySettings } from "@/modules/foundation/settings/service";

const money = (n: number | string, cur = "SAR") => `${Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${cur}`;
const date = (d: Date | string | null | undefined) => (d ? new Date(d).toISOString().slice(0, 10) : "");

function KV({ ar, en, value, ltr, small }: { ar: string; en: string; value: string; ltr?: boolean; small?: boolean }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }}>
      <Text style={[pdfStyles.label, { width: 64 }]}>{en}</Text>
      <Text style={[{ flex: 1, textAlign: "center" }, small ? { fontSize: 6 } : {}, ltr ? {} : pdfStyles.rtl]}>{value}</Text>
      <Text style={[pdfStyles.label, pdfStyles.rtl, { width: 64 }]}>{ar}</Text>
    </View>
  );
}

function Th({ ar, en, w, align }: { ar: string; en: string; w: string; align?: "right" | "left" | "center" }) {
  return (
    <View style={[pdfStyles.th, { width: w }]}>
      <Text style={{ textAlign: align ?? "center", fontSize: 7 }}>{en}</Text>
      <Text style={{ textAlign: align ?? "center", fontSize: 7 }}>{ar}</Text>
    </View>
  );
}

export type PdfDocLine = { lineNo: number; descriptionAr: string; descriptionEn: string; quantity: number; unitPrice: number; discountAmount: number; net: number; taxRate: number; tax: number; total: number };
export type PdfPartyDoc = {
  number: string;
  kind: "INVOICE" | "CREDIT_NOTE" | "DEBIT_NOTE" | "BILL" | "QUOTE" | "ORDER" | "PO";
  type?: "STANDARD" | "SIMPLIFIED";
  docDate: Date | string;
  dueDate: Date | string;
  supplyDate?: Date | string | null;
  reference?: string | null;
  vendorInvoiceNumber?: string | null;
  originalNumber?: string | null;
  currencyCode: string;
  party: { nameAr: string; nameEn: string; vatNumber?: string | null; crNumber?: string | null; addressAr?: string | null; addressEn?: string | null; city?: string | null; phone?: string | null; email?: string | null };
  lines: PdfDocLine[];
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  total: number;
  paidAmount: number;
  notes?: string | null;
  zatca?: { uuid: string; qrDataUrl: string | null; invoiceHash: string } | null;
  status: string;
};

const TITLES: Record<string, { ar: string; en: string }> = {
  "INVOICE-STANDARD": { ar: "فاتورة ضريبية", en: "Tax Invoice" },
  "INVOICE-SIMPLIFIED": { ar: "فاتورة ضريبية مبسطة", en: "Simplified Tax Invoice" },
  "CREDIT_NOTE-STANDARD": { ar: "إشعار دائن", en: "Credit Note" },
  "CREDIT_NOTE-SIMPLIFIED": { ar: "إشعار دائن مبسط", en: "Simplified Credit Note" },
  "DEBIT_NOTE-STANDARD": { ar: "إشعار مدين", en: "Debit Note" },
  "DEBIT_NOTE-SIMPLIFIED": { ar: "إشعار مدين مبسط", en: "Simplified Debit Note" },
  BILL: { ar: "فاتورة مورد", en: "Vendor Bill" },
  QUOTE: { ar: "عرض سعر", en: "Quotation" },
  ORDER: { ar: "أمر بيع", en: "Sales Order" },
  PO: { ar: "أمر شراء", en: "Purchase Order" },
};

/** Invoice / credit note / vendor bill. */
export function PartyDocPdf({ company, settings, doc, printedBy }: { company: PdfCompany; settings: CompanySettings; doc: PdfPartyDoc; printedBy?: string }) {
  const title = TITLES[doc.kind === "BILL" || doc.kind === "QUOTE" || doc.kind === "ORDER" || doc.kind === "PO" ? doc.kind : `${doc.kind}-${doc.type ?? "STANDARD"}`] ?? TITLES["INVOICE-STANDARD"];
  const cur = doc.currencyCode;
  const isAr = doc.kind !== "BILL" && doc.kind !== "PO";
  return (
    <PdfFrame company={company} titleAr={title.ar} titleEn={title.en} printedBy={printedBy}>
      <View style={{ flexDirection: "row", gap: 8, marginBottom: 8 }}>
        <View style={[pdfStyles.box, { flex: 1 }]}>
          <Text style={[pdfStyles.bold, { marginBottom: 3 }]}>{isAr ? "Bill to / العميل" : "Vendor / المورد"}</Text>
          <Text>{doc.party.nameEn}</Text>
          <Text style={pdfStyles.rtl}>{doc.party.nameAr}</Text>
          {doc.party.addressEn ? <Text style={pdfStyles.small}>{doc.party.addressEn}{doc.party.city ? `, ${doc.party.city}` : ""}</Text> : null}
          {doc.party.vatNumber ? <Text style={pdfStyles.small}>VAT: {doc.party.vatNumber} / الرقم الضريبي</Text> : null}
          {doc.party.crNumber ? <Text style={pdfStyles.small}>CR: {doc.party.crNumber}</Text> : null}
          {doc.party.phone ? <Text style={pdfStyles.small}>{doc.party.phone}</Text> : null}
        </View>
        <View style={[pdfStyles.box, { flex: 1 }]}>
          <KV ar="الرقم" en="Number" value={doc.number} ltr />
          <KV ar="التاريخ" en="Date" value={date(doc.docDate)} ltr />
          <KV ar={doc.kind === "QUOTE" ? "صالح حتى" : doc.kind === "ORDER" || doc.kind === "PO" ? "تاريخ التسليم" : "تاريخ الاستحقاق"} en={doc.kind === "QUOTE" ? "Valid until" : doc.kind === "ORDER" || doc.kind === "PO" ? "Delivery date" : "Due date"} value={date(doc.dueDate)} ltr />
          {doc.supplyDate ? <KV ar="تاريخ التوريد" en="Supply date" value={date(doc.supplyDate)} ltr /> : null}
          {doc.vendorInvoiceNumber ? <KV ar="رقم فاتورة المورد" en="Vendor inv. no." value={doc.vendorInvoiceNumber} ltr /> : null}
          {doc.originalNumber ? <KV ar="الفاتورة الأصلية" en="Original invoice" value={doc.originalNumber} ltr /> : null}
          {doc.reference ? <KV ar="المرجع" en="Reference" value={doc.reference} ltr /> : null}
          {doc.zatca ? <KV ar="المعرف" en="UUID" value={doc.zatca.uuid} ltr small /> : null}
        </View>
        {doc.zatca?.qrDataUrl && settings.showQr ? (
          <View style={{ width: 90, alignItems: "center", justifyContent: "center" }}>
            {/* eslint-disable-next-line jsx-a11y/alt-text */}
            <Image src={doc.zatca.qrDataUrl} style={{ width: 86, height: 86 }} />
          </View>
        ) : null}
      </View>

      <View style={pdfStyles.table}>
        <View style={[pdfStyles.tr, { backgroundColor: "#1e3a5f" }]} fixed>
          <Th ar="#" en="#" w="4%" />
          <Th ar="الوصف" en="Description" w="34%" align="left" />
          <Th ar="الكمية" en="Qty" w="8%" />
          <Th ar="السعر" en="Unit price" w="12%" align="right" />
          <Th ar="الخصم" en="Discount" w="10%" align="right" />
          <Th ar="الصافي" en="Net" w="12%" align="right" />
          <Th ar="الضريبة" en="VAT" w="10%" align="right" />
          <Th ar="الإجمالي" en="Total" w="10%" align="right" />
        </View>
        {doc.lines.map((l, i) => (
          <View key={l.lineNo} style={[pdfStyles.tr, i % 2 ? { backgroundColor: "#f5f7fa" } : {}]} wrap={false}>
            <Text style={[pdfStyles.td, { width: "4%", textAlign: "center" }]}>{l.lineNo}</Text>
            <View style={[pdfStyles.td, { width: "34%" }]}>
              <Text>{l.descriptionEn}</Text>
              <Text style={[pdfStyles.rtl, { color: "#444" }]}>{l.descriptionAr}</Text>
            </View>
            <Text style={[pdfStyles.td, { width: "8%", textAlign: "center" }]}>{Number(l.quantity)}</Text>
            <Text style={[pdfStyles.td, { width: "12%", textAlign: "right" }]}>{Number(l.unitPrice).toFixed(2)}</Text>
            <Text style={[pdfStyles.td, { width: "10%", textAlign: "right" }]}>{Number(l.discountAmount) ? Number(l.discountAmount).toFixed(2) : "-"}</Text>
            <Text style={[pdfStyles.td, { width: "12%", textAlign: "right" }]}>{Number(l.net).toFixed(2)}</Text>
            <View style={[pdfStyles.td, { width: "10%" }]}>
              <Text style={{ textAlign: "right" }}>{Number(l.tax).toFixed(2)}</Text>
              <Text style={{ textAlign: "right", color: "#666", fontSize: 7 }}>{Number(l.taxRate)}%</Text>
            </View>
            <Text style={[pdfStyles.td, { width: "10%", textAlign: "right" }]}>{Number(l.total).toFixed(2)}</Text>
          </View>
        ))}
      </View>

      <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 8 }} wrap={false}>
        <View style={{ width: "55%" }}>
          {doc.notes ? <Text style={pdfStyles.small}>{doc.notes}</Text> : null}
          {isAr && settings.invoiceTermsEn ? <Text style={[pdfStyles.small, { marginTop: 4 }]}>{settings.invoiceTermsEn}</Text> : null}
          {isAr && settings.invoiceTermsAr ? <Text style={[pdfStyles.small, pdfStyles.rtl]}>{settings.invoiceTermsAr}</Text> : null}
          {isAr && settings.bankDetails ? <Text style={[pdfStyles.small, { marginTop: 4 }]}>{settings.bankDetails}</Text> : null}
        </View>
        <View style={[pdfStyles.box, { width: "40%" }]}>
          <KV ar="المجموع" en="Subtotal" value={money(doc.subtotal, cur)} ltr />
          <KV ar="الخصم" en="Discount" value={money(doc.discountTotal, cur)} ltr />
          <KV ar="الصافي" en="Taxable amount" value={money(doc.subtotal - doc.discountTotal, cur)} ltr />
          <KV ar="ضريبة القيمة المضافة" en="VAT" value={money(doc.taxTotal, cur)} ltr />
          <View style={{ borderTopWidth: 0.5, borderTopColor: "#999", marginVertical: 2 }} />
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={pdfStyles.bold}>Total</Text>
            <Text style={pdfStyles.bold}>{money(doc.total, cur)}</Text>
            <Text style={[pdfStyles.bold, pdfStyles.rtl]}>الإجمالي شامل الضريبة</Text>
          </View>
          {doc.paidAmount > 0 ? <KV ar="المدفوع" en="Paid" value={money(doc.paidAmount, cur)} ltr /> : null}
          {doc.paidAmount > 0 ? <KV ar="المتبقي" en="Balance due" value={money(doc.total - doc.paidAmount, cur)} ltr /> : null}
        </View>
      </View>
      {isAr && (settings.invoiceFooterEn || settings.invoiceFooterAr) ? (
        <View style={{ marginTop: 14, alignItems: "center" }}>
          <Text style={pdfStyles.small}>{settings.invoiceFooterEn}</Text>
          <Text style={[pdfStyles.small, pdfStyles.rtl]}>{settings.invoiceFooterAr}</Text>
        </View>
      ) : null}
      {doc.status === "DRAFT" || doc.status === "CANCELLED" || doc.status === "REVERSED" ? (
        <Text style={{ position: "absolute", top: 300, left: 150, fontSize: 48, color: "#cc000033", transform: "rotate(-25deg)", fontWeight: 700 }}>{doc.status}</Text>
      ) : null}
    </PdfFrame>
  );
}

export type PdfSettlement = { number: string; kind: "RECEIPT" | "PAYMENT"; date: Date | string; method: string; bankAccount?: string | null; currencyCode: string; amount: number; reference?: string | null; notes?: string | null; party: { nameAr: string; nameEn: string }; allocations: { number: string; date: Date | string; amount: number }[]; status: string };

/** Receipt voucher / payment voucher. */
export function SettlementPdf({ company, doc, printedBy }: { company: PdfCompany; doc: PdfSettlement; printedBy?: string }) {
  const isReceipt = doc.kind === "RECEIPT";
  return (
    <PdfFrame company={company} titleAr={isReceipt ? "سند قبض" : "سند صرف"} titleEn={isReceipt ? "Receipt Voucher" : "Payment Voucher"} printedBy={printedBy}>
      <View style={[pdfStyles.box, { marginBottom: 8 }]}>
        <KV ar="الرقم" en="Number" value={doc.number} ltr />
        <KV ar="التاريخ" en="Date" value={date(doc.date)} ltr />
        <KV ar={isReceipt ? "استلمنا من" : "صرفنا إلى"} en={isReceipt ? "Received from" : "Paid to"} value={`${doc.party.nameEn} / ${doc.party.nameAr}`} />
        <KV ar="المبلغ" en="Amount" value={money(doc.amount, doc.currencyCode)} ltr />
        <KV ar="طريقة الدفع" en="Method" value={`${doc.method}${doc.bankAccount ? ` — ${doc.bankAccount}` : ""}`} ltr />
        {doc.reference ? <KV ar="المرجع" en="Reference" value={doc.reference} ltr /> : null}
        {doc.notes ? <KV ar="ملاحظات" en="Notes" value={doc.notes} /> : null}
      </View>
      {doc.allocations.length > 0 ? (
        <View style={pdfStyles.table}>
          <View style={[pdfStyles.tr, { backgroundColor: "#1e3a5f" }]}>
            <Th ar="المستند" en="Document" w="40%" align="left" />
            <Th ar="التاريخ" en="Date" w="30%" />
            <Th ar="المبلغ" en="Amount" w="30%" align="right" />
          </View>
          {doc.allocations.map((a) => (
            <View key={a.number} style={pdfStyles.tr}>
              <Text style={[pdfStyles.td, { width: "40%" }]}>{a.number}</Text>
              <Text style={[pdfStyles.td, { width: "30%", textAlign: "center" }]}>{date(a.date)}</Text>
              <Text style={[pdfStyles.td, { width: "30%", textAlign: "right" }]}>{money(a.amount, doc.currencyCode)}</Text>
            </View>
          ))}
        </View>
      ) : null}
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 40 }}>
        <Text style={pdfStyles.small}>Prepared by / أعده: ____________________</Text>
        <Text style={pdfStyles.small}>Approved by / اعتمده: ____________________</Text>
        <Text style={pdfStyles.small}>{isReceipt ? "Received by / المستلم" : "Recipient / المستفيد"}: ____________________</Text>
      </View>
    </PdfFrame>
  );
}

export type PdfJournal = { number: string; entryDate: Date | string; description?: string | null; reference?: string | null; status: string; source: string; currencyCode: string; lines: { lineNo: number; accountCode: string; accountNameAr: string; accountNameEn: string; costCenter?: string | null; description?: string | null; debit: number; credit: number }[]; totalDebit: number; totalCredit: number };

export function JournalPdf({ company, doc, printedBy }: { company: PdfCompany; doc: PdfJournal; printedBy?: string }) {
  return (
    <PdfFrame company={company} titleAr="قيد يومية" titleEn="Journal Voucher" printedBy={printedBy}>
      <View style={[pdfStyles.box, { marginBottom: 8 }]}>
        <KV ar="الرقم" en="Number" value={doc.number} ltr />
        <KV ar="التاريخ" en="Date" value={date(doc.entryDate)} ltr />
        <KV ar="المصدر" en="Source" value={doc.source} ltr />
        {doc.reference ? <KV ar="المرجع" en="Reference" value={doc.reference} ltr /> : null}
        {doc.description ? <KV ar="البيان" en="Description" value={doc.description} /> : null}
      </View>
      <View style={pdfStyles.table}>
        <View style={[pdfStyles.tr, { backgroundColor: "#1e3a5f" }]} fixed>
          <Th ar="الحساب" en="Account" w="38%" align="left" />
          <Th ar="مركز التكلفة" en="Cost center" w="12%" />
          <Th ar="البيان" en="Description" w="26%" align="left" />
          <Th ar="مدين" en="Debit" w="12%" align="right" />
          <Th ar="دائن" en="Credit" w="12%" align="right" />
        </View>
        {doc.lines.map((l) => (
          <View key={l.lineNo} style={pdfStyles.tr} wrap={false}>
            <View style={[pdfStyles.td, { width: "38%" }]}>
              <Text>{l.accountCode} · {l.accountNameEn}</Text>
              <Text style={[pdfStyles.rtl, { color: "#444" }]}>{l.accountNameAr}</Text>
            </View>
            <Text style={[pdfStyles.td, { width: "12%", textAlign: "center" }]}>{l.costCenter ?? ""}</Text>
            <Text style={[pdfStyles.td, { width: "26%" }]}>{l.description ?? ""}</Text>
            <Text style={[pdfStyles.td, { width: "12%", textAlign: "right" }]}>{Number(l.debit) ? Number(l.debit).toFixed(2) : ""}</Text>
            <Text style={[pdfStyles.td, { width: "12%", textAlign: "right" }]}>{Number(l.credit) ? Number(l.credit).toFixed(2) : ""}</Text>
          </View>
        ))}
        <View style={[pdfStyles.tr, { backgroundColor: "#eef2f7" }]}>
          <Text style={[pdfStyles.td, pdfStyles.bold, { width: "76%", textAlign: "right" }]}>Total / الإجمالي ({doc.currencyCode})</Text>
          <Text style={[pdfStyles.td, pdfStyles.bold, { width: "12%", textAlign: "right" }]}>{Number(doc.totalDebit).toFixed(2)}</Text>
          <Text style={[pdfStyles.td, pdfStyles.bold, { width: "12%", textAlign: "right" }]}>{Number(doc.totalCredit).toFixed(2)}</Text>
        </View>
      </View>
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 40 }}>
        <Text style={pdfStyles.small}>Prepared by / أعده: ____________________</Text>
        <Text style={pdfStyles.small}>Reviewed by / راجعه: ____________________</Text>
        <Text style={pdfStyles.small}>Approved by / اعتمده: ____________________</Text>
      </View>
    </PdfFrame>
  );
}
