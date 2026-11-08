import { createHash, randomUUID } from "node:crypto";
import { create } from "xmlbuilder2";

/**
 * ZATCA (Fatoora) Phase 2 readiness.
 * - TLV/Base64 QR (tags 1–9)
 * - UUID, ICV counter, PIH (previous invoice hash) chain
 * - SHA-256 invoice hash over the UBL XML
 * - UBL 2.1 XML for standard (B2B) and simplified (B2C) invoices, credit & debit notes
 * Signing (ECDSA secp256k1 with the EGS CSID certificate) and the clearance/reporting
 * API calls are behind the ZatcaClient interface; the StubZatcaClient does not transmit.
 */

export type ZatcaSeller = { nameAr: string; nameEn: string; vatNumber: string; crNumber?: string | null; street?: string | null; buildingNo?: string | null; district?: string | null; city?: string | null; postalCode?: string | null; country?: string };
export type ZatcaBuyer = { name: string; vatNumber?: string | null; crNumber?: string | null; street?: string | null; buildingNo?: string | null; district?: string | null; city?: string | null; postalCode?: string | null; country?: string };
export type ZatcaLine = { id: number; name: string; quantity: number; unit?: string; unitPrice: number; net: number; discount: number; taxRate: number; taxAmount: number; total: number; taxCategory: "S" | "Z" | "E" | "O" };
export type ZatcaInvoice = {
  number: string;
  uuid: string;
  issueDate: Date;
  supplyDate?: Date | null;
  type: "STANDARD" | "SIMPLIFIED";
  kind: "INVOICE" | "CREDIT_NOTE" | "DEBIT_NOTE";
  originalNumber?: string | null;
  reason?: string | null;
  currency: string;
  icv: number;
  previousHash: string;
  seller: ZatcaSeller;
  buyer?: ZatcaBuyer | null;
  lines: ZatcaLine[];
  subtotal: number; // sum of line net (after discounts)
  discountTotal: number;
  taxTotal: number;
  total: number;
  paymentMeans?: string; // 10 cash, 30 credit, 42 bank, 48 card
};

/** First invoice in a chain uses the base64 of SHA-256("0"). */
export const GENESIS_HASH = Buffer.from(createHash("sha256").update("0").digest("hex")).toString("base64");

const fmt = (n: number) => (Math.round(n * 100) / 100).toFixed(2);
const isoDate = (d: Date) => d.toISOString().slice(0, 10);
const isoTime = (d: Date) => d.toISOString().slice(11, 19);

/** Invoice type code: 388 invoice, 381 credit note, 383 debit note; name 0100000 standard / 0200000 simplified */
export function invoiceTypeCode(kind: ZatcaInvoice["kind"]) {
  return kind === "CREDIT_NOTE" ? "381" : kind === "DEBIT_NOTE" ? "383" : "388";
}
export function invoiceTypeName(type: ZatcaInvoice["type"]) {
  return type === "SIMPLIFIED" ? "0200000" : "0100000";
}

/** Builds UBL 2.1 XML per ZATCA e-invoicing XML implementation standard (unsigned). */
export function buildUblXml(inv: ZatcaInvoice): string {
  const taxCategoryName = (c: ZatcaLine["taxCategory"]) => ({ S: "S", Z: "Z", E: "E", O: "O" })[c];
  const groups = new Map<string, { rate: number; taxable: number; tax: number; category: string }>();
  for (const l of inv.lines) {
    const k = `${l.taxCategory}-${l.taxRate}`;
    const g = groups.get(k) ?? { rate: l.taxRate, taxable: 0, tax: 0, category: l.taxCategory };
    g.taxable += l.net;
    g.tax += l.taxAmount;
    groups.set(k, g);
  }
  const doc = create({ version: "1.0", encoding: "UTF-8" }).ele("Invoice", {
    xmlns: "urn:oasis:names:specification:ubl:schema:xsd:Invoice-2",
    "xmlns:cac": "urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2",
    "xmlns:cbc": "urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2",
    "xmlns:ext": "urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2",
  });
  doc.ele("cbc:ProfileID").txt("reporting:1.0");
  doc.ele("cbc:ID").txt(inv.number);
  doc.ele("cbc:UUID").txt(inv.uuid);
  doc.ele("cbc:IssueDate").txt(isoDate(inv.issueDate));
  doc.ele("cbc:IssueTime").txt(isoTime(inv.issueDate));
  doc.ele("cbc:InvoiceTypeCode", { name: invoiceTypeName(inv.type) }).txt(invoiceTypeCode(inv.kind));
  if (inv.kind !== "INVOICE" && inv.reason) doc.ele("cbc:Note", { languageID: "ar" }).txt(inv.reason);
  doc.ele("cbc:DocumentCurrencyCode").txt(inv.currency);
  doc.ele("cbc:TaxCurrencyCode").txt("SAR");
  if (inv.kind !== "INVOICE" && inv.originalNumber) {
    doc.ele("cac:BillingReference").ele("cac:InvoiceDocumentReference").ele("cbc:ID").txt(inv.originalNumber);
  }
  doc.ele("cac:AdditionalDocumentReference").ele("cbc:ID").txt("ICV").up().ele("cbc:UUID").txt(String(inv.icv));
  const pih = doc.ele("cac:AdditionalDocumentReference");
  pih.ele("cbc:ID").txt("PIH");
  pih.ele("cac:Attachment").ele("cbc:EmbeddedDocumentBinaryObject", { mimeCode: "text/plain" }).txt(inv.previousHash);

  // Seller
  const sp = doc.ele("cac:AccountingSupplierParty").ele("cac:Party");
  if (inv.seller.crNumber) sp.ele("cac:PartyIdentification").ele("cbc:ID", { schemeID: "CRN" }).txt(inv.seller.crNumber);
  const sa = sp.ele("cac:PostalAddress");
  sa.ele("cbc:StreetName").txt(inv.seller.street ?? "");
  sa.ele("cbc:BuildingNumber").txt(inv.seller.buildingNo ?? "0000");
  sa.ele("cbc:CitySubdivisionName").txt(inv.seller.district ?? "");
  sa.ele("cbc:CityName").txt(inv.seller.city ?? "");
  sa.ele("cbc:PostalZone").txt(inv.seller.postalCode ?? "00000");
  sa.ele("cac:Country").ele("cbc:IdentificationCode").txt(inv.seller.country ?? "SA");
  sp.ele("cac:PartyTaxScheme").ele("cbc:CompanyID").txt(inv.seller.vatNumber).up().ele("cac:TaxScheme").ele("cbc:ID").txt("VAT");
  sp.ele("cac:PartyLegalEntity").ele("cbc:RegistrationName").txt(inv.seller.nameAr);

  // Buyer (mandatory for standard)
  if (inv.type === "STANDARD" || inv.buyer) {
    const bp = doc.ele("cac:AccountingCustomerParty").ele("cac:Party");
    const b = inv.buyer ?? { name: "" };
    if (b.crNumber) bp.ele("cac:PartyIdentification").ele("cbc:ID", { schemeID: "CRN" }).txt(b.crNumber);
    const ba = bp.ele("cac:PostalAddress");
    ba.ele("cbc:StreetName").txt(b.street ?? "");
    ba.ele("cbc:BuildingNumber").txt(b.buildingNo ?? "0000");
    ba.ele("cbc:CitySubdivisionName").txt(b.district ?? "");
    ba.ele("cbc:CityName").txt(b.city ?? "");
    ba.ele("cbc:PostalZone").txt(b.postalCode ?? "00000");
    ba.ele("cac:Country").ele("cbc:IdentificationCode").txt(b.country ?? "SA");
    if (b.vatNumber) bp.ele("cac:PartyTaxScheme").ele("cbc:CompanyID").txt(b.vatNumber).up().ele("cac:TaxScheme").ele("cbc:ID").txt("VAT");
    bp.ele("cac:PartyLegalEntity").ele("cbc:RegistrationName").txt(b.name);
  }
  if (inv.supplyDate) doc.ele("cac:Delivery").ele("cbc:ActualDeliveryDate").txt(isoDate(inv.supplyDate));
  const pm = doc.ele("cac:PaymentMeans");
  pm.ele("cbc:PaymentMeansCode").txt(inv.paymentMeans ?? "30");
  if (inv.kind !== "INVOICE") pm.ele("cbc:InstructionNote").txt(inv.reason ?? "Adjustment");

  if (inv.discountTotal > 0) {
    const ac = doc.ele("cac:AllowanceCharge");
    ac.ele("cbc:ChargeIndicator").txt("false");
    ac.ele("cbc:AllowanceChargeReason").txt("Discount");
    ac.ele("cbc:Amount", { currencyID: inv.currency }).txt(fmt(inv.discountTotal));
    ac.ele("cac:TaxCategory").ele("cbc:ID").txt("S").up().ele("cbc:Percent").txt("15.00").up().ele("cac:TaxScheme").ele("cbc:ID").txt("VAT");
  }

  const tt = doc.ele("cac:TaxTotal");
  tt.ele("cbc:TaxAmount", { currencyID: inv.currency }).txt(fmt(inv.taxTotal));
  for (const g of groups.values()) {
    const st = tt.ele("cac:TaxSubtotal");
    st.ele("cbc:TaxableAmount", { currencyID: inv.currency }).txt(fmt(g.taxable));
    st.ele("cbc:TaxAmount", { currencyID: inv.currency }).txt(fmt(g.tax));
    const tc = st.ele("cac:TaxCategory");
    tc.ele("cbc:ID").txt(taxCategoryName(g.category as ZatcaLine["taxCategory"]));
    tc.ele("cbc:Percent").txt(fmt(g.rate));
    if (g.category === "Z") tc.ele("cbc:TaxExemptionReasonCode").txt("VATEX-SA-32").up().ele("cbc:TaxExemptionReason").txt("Export of goods");
    if (g.category === "E") tc.ele("cbc:TaxExemptionReasonCode").txt("VATEX-SA-29").up().ele("cbc:TaxExemptionReason").txt("Financial services");
    if (g.category === "O") tc.ele("cbc:TaxExemptionReasonCode").txt("VATEX-SA-OOS").up().ele("cbc:TaxExemptionReason").txt("Out of scope");
    tc.ele("cac:TaxScheme").ele("cbc:ID").txt("VAT");
  }
  doc.ele("cac:TaxTotal").ele("cbc:TaxAmount", { currencyID: "SAR" }).txt(fmt(inv.taxTotal));

  const lm = doc.ele("cac:LegalMonetaryTotal");
  lm.ele("cbc:LineExtensionAmount", { currencyID: inv.currency }).txt(fmt(inv.subtotal));
  lm.ele("cbc:TaxExclusiveAmount", { currencyID: inv.currency }).txt(fmt(inv.subtotal - inv.discountTotal));
  lm.ele("cbc:TaxInclusiveAmount", { currencyID: inv.currency }).txt(fmt(inv.total));
  lm.ele("cbc:AllowanceTotalAmount", { currencyID: inv.currency }).txt(fmt(inv.discountTotal));
  lm.ele("cbc:PrepaidAmount", { currencyID: inv.currency }).txt("0.00");
  lm.ele("cbc:PayableAmount", { currencyID: inv.currency }).txt(fmt(inv.total));

  for (const l of inv.lines) {
    const il = doc.ele("cac:InvoiceLine");
    il.ele("cbc:ID").txt(String(l.id));
    il.ele("cbc:InvoicedQuantity", { unitCode: l.unit ?? "PCE" }).txt(String(l.quantity));
    il.ele("cbc:LineExtensionAmount", { currencyID: inv.currency }).txt(fmt(l.net));
    if (l.discount > 0) {
      const ac = il.ele("cac:AllowanceCharge");
      ac.ele("cbc:ChargeIndicator").txt("false");
      ac.ele("cbc:AllowanceChargeReason").txt("Discount");
      ac.ele("cbc:Amount", { currencyID: inv.currency }).txt(fmt(l.discount));
    }
    const lt = il.ele("cac:TaxTotal");
    lt.ele("cbc:TaxAmount", { currencyID: inv.currency }).txt(fmt(l.taxAmount));
    lt.ele("cbc:RoundingAmount", { currencyID: inv.currency }).txt(fmt(l.total));
    const item = il.ele("cac:Item");
    item.ele("cbc:Name").txt(l.name);
    const ctc = item.ele("cac:ClassifiedTaxCategory");
    ctc.ele("cbc:ID").txt(taxCategoryName(l.taxCategory));
    ctc.ele("cbc:Percent").txt(fmt(l.taxRate));
    ctc.ele("cac:TaxScheme").ele("cbc:ID").txt("VAT");
    il.ele("cac:Price").ele("cbc:PriceAmount", { currencyID: inv.currency }).txt(fmt(l.unitPrice));
  }
  return doc.end({ prettyPrint: true });
}

/** SHA-256 of the XML, base64 encoded (ZATCA invoice hash). */
export function invoiceHash(xml: string): string {
  return createHash("sha256").update(xml, "utf8").digest("base64");
}

/** TLV-encodes QR tags and returns Base64. */
export function buildQrTlv(tags: { tag: number; value: string | Buffer }[]): string {
  const parts: Buffer[] = [];
  for (const { tag, value } of tags) {
    const v = Buffer.isBuffer(value) ? value : Buffer.from(value, "utf8");
    if (v.length > 255) throw new Error(`QR tag ${tag} too long`);
    parts.push(Buffer.from([tag, v.length]), v);
  }
  return Buffer.concat(parts).toString("base64");
}

export type SigningResult = { signature: string; publicKey: string; certificateSignature: string; signedXml: string };

/** Signing/transport abstraction. Real implementation requires EGS onboarding (CSID) and ECDSA keys. */
export interface ZatcaClient {
  readonly mode: "STUB" | "SIMULATION" | "PRODUCTION";
  sign(xml: string, hash: string): Promise<SigningResult>;
  reportSimplified(payload: { uuid: string; hash: string; signedXml: string }): Promise<{ status: string; response: unknown }>;
  clearStandard(payload: { uuid: string; hash: string; signedXml: string }): Promise<{ status: string; response: unknown }>;
}

export class StubZatcaClient implements ZatcaClient {
  readonly mode = "STUB" as const;
  async sign(xml: string, hash: string): Promise<SigningResult> {
    void hash;
    return { signature: "STUB-SIGNATURE", publicKey: "STUB-PUBLIC-KEY", certificateSignature: "STUB-CERT-SIGNATURE", signedXml: xml };
  }
  async reportSimplified() {
    return { status: "NOT_SUBMITTED", response: { message: "Stub client: configure ZATCA EGS credentials to enable reporting." } };
  }
  async clearStandard() {
    return { status: "NOT_SUBMITTED", response: { message: "Stub client: configure ZATCA EGS credentials to enable clearance." } };
  }
}

export function getZatcaClient(): ZatcaClient {
  // Swap in a real client when ZATCA_MODE / certificates are configured.
  return new StubZatcaClient();
}

/** Full Phase-2 QR: tags 1–5 (Phase 1) + 6 hash, 7 signature, 8 public key, 9 cert signature (standard omits 9 is allowed but we include). */
export function buildPhase2Qr(inv: Pick<ZatcaInvoice, "seller" | "issueDate" | "total" | "taxTotal">, hash: string, signing: SigningResult) {
  return buildQrTlv([
    { tag: 1, value: inv.seller.nameAr },
    { tag: 2, value: inv.seller.vatNumber },
    { tag: 3, value: inv.issueDate.toISOString().replace(/\.\d{3}Z$/, "Z") },
    { tag: 4, value: fmt(inv.total) },
    { tag: 5, value: fmt(inv.taxTotal) },
    { tag: 6, value: hash },
    { tag: 7, value: Buffer.from(signing.signature) },
    { tag: 8, value: Buffer.from(signing.publicKey) },
    { tag: 9, value: Buffer.from(signing.certificateSignature) },
  ]);
}

export function newUuid() {
  return randomUUID();
}
