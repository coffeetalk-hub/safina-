import React from "react";
import { Document, Page, Text, View, Image, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import type { Style } from "@react-pdf/stylesheet";
import { registerPdfFonts } from "./fonts";

export type PdfCompany = {
  nameAr: string;
  nameEn: string;
  crNumber?: string | null;
  vatNumber?: string | null;
  addressAr?: string | null;
  addressEn?: string | null;
  phone?: string | null;
  email?: string | null;
  logoDataUrl?: string | null;
};

export const pdfStyles = StyleSheet.create({
  page: { fontFamily: "Plex", fontSize: 9, padding: 32, paddingBottom: 48, color: "#111" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", borderBottomWidth: 1.5, borderBottomColor: "#1e3a5f", paddingBottom: 8, marginBottom: 10 },
  logo: { maxHeight: 48, maxWidth: 140, objectFit: "contain" },
  companyAr: { fontSize: 12, fontWeight: 700, textAlign: "right" },
  companyEn: { fontSize: 11, fontWeight: 700 },
  small: { fontSize: 8, color: "#444" },
  title: { fontSize: 15, fontWeight: 700, color: "#1e3a5f", marginBottom: 2 },
  subtitle: { fontSize: 9, color: "#555", marginBottom: 8 },
  table: { width: "100%", borderWidth: 0.5, borderColor: "#bbb" },
  tr: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#ddd" },
  th: { backgroundColor: "#1e3a5f", color: "#fff", fontWeight: 700, padding: 4, fontSize: 8 },
  td: { padding: 4, fontSize: 8 },
  footer: { position: "absolute", bottom: 20, left: 32, right: 32, flexDirection: "row", justifyContent: "space-between", fontSize: 7, color: "#666", borderTopWidth: 0.5, borderTopColor: "#ccc", paddingTop: 4 },
  rtl: { textAlign: "right" },
  ltr: { textAlign: "left" },
  bold: { fontWeight: 700 },
  row: { flexDirection: "row" },
  right: { textAlign: "right" },
  box: { borderWidth: 0.5, borderColor: "#bbb", padding: 6, borderRadius: 2 },
  label: { fontSize: 7, color: "#666" },
});

/** Bilingual label: Arabic / English on the same line. */
export function Bi({ ar, en, style }: { ar: string; en: string; style?: Style | Style[] }) {
  return (
    <Text style={style}>
      {ar} / {en}
    </Text>
  );
}

/** Shared page frame: company header, document title, footer with page numbers. */
export function PdfFrame({ company, titleAr, titleEn, subtitle, children, landscape, printedBy }: { company: PdfCompany; titleAr: string; titleEn: string; subtitle?: string; children: React.ReactNode; landscape?: boolean; printedBy?: string }) {
  const printedAt = new Date().toISOString().slice(0, 16).replace("T", " ");
  return (
    <Document title={`${titleEn} - ${company.nameEn}`} author="Safina ERP" creator="Safina ERP">
      <Page size="A4" orientation={landscape ? "landscape" : "portrait"} style={pdfStyles.page}>
        <View style={pdfStyles.header} fixed>
          <View style={{ width: "35%" }}>
            <Text style={pdfStyles.companyEn}>{company.nameEn}</Text>
            {company.addressEn && <Text style={pdfStyles.small}>{company.addressEn}</Text>}
            {company.crNumber && <Text style={pdfStyles.small}>CR: {company.crNumber}</Text>}
            {company.vatNumber && <Text style={pdfStyles.small}>VAT: {company.vatNumber}</Text>}
          </View>
          <View style={{ width: "25%", alignItems: "center" }}>{/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt prop */}
            {company.logoDataUrl ? <Image src={company.logoDataUrl} style={pdfStyles.logo} /> : null}</View>
          <View style={{ width: "35%", alignItems: "flex-end" }}>
            <Text style={pdfStyles.companyAr}>{company.nameAr}</Text>
            {company.addressAr && <Text style={[pdfStyles.small, pdfStyles.rtl]}>{company.addressAr}</Text>}
            {company.crNumber && <Text style={[pdfStyles.small, pdfStyles.rtl]}>س.ت: {company.crNumber}</Text>}
            {company.vatNumber && <Text style={[pdfStyles.small, pdfStyles.rtl]}>الرقم الضريبي: {company.vatNumber}</Text>}
          </View>
        </View>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" }}>
          <Text style={pdfStyles.title}>{titleEn}</Text>
          <Text style={[pdfStyles.title, pdfStyles.rtl]}>{titleAr}</Text>
        </View>
        {subtitle && <Text style={pdfStyles.subtitle}>{subtitle}</Text>}
        {children}
        <View style={pdfStyles.footer} fixed>
          <Text>Safina ERP · {printedAt}{printedBy ? ` · ${printedBy}` : ""}</Text>
          <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}

export async function renderPdf(doc: React.ReactElement): Promise<Buffer> {
  registerPdfFonts();
  // renderToBuffer expects a <Document/> element
  const buf = await renderToBuffer(doc as React.ReactElement<React.ComponentProps<typeof Document>>);
  return Buffer.from(buf);
}

export function pdfResponse(buffer: Buffer, fileName: string, inline = true) {
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(fileName)}.pdf`,
    },
  });
}
