import React from "react";
import { Text, View } from "@react-pdf/renderer";
import { PdfFrame, pdfStyles, type PdfCompany } from "./base";
import { cellValue, type ColumnDef } from "@/components/data-table/types";

function fmt(col: ColumnDef, v: unknown, enumLabel?: (e: string, v: string) => string): string {
  if (v === null || v === undefined || v === "") return "";
  switch (col.type) {
    case "money":
      return Number(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    case "number":
      return Number(v).toLocaleString("en-US", { maximumFractionDigits: 2 });
    case "date":
      return new Date(String(v)).toISOString().slice(0, 10);
    case "datetime":
      return new Date(String(v)).toISOString().slice(0, 16).replace("T", " ");
    case "boolean":
      return v ? "✓" : "";
    case "enum":
      return enumLabel && col.enumName ? enumLabel(col.enumName, String(v)) : String(v);
    default:
      return typeof v === "object" ? JSON.stringify(v) : String(v);
  }
}

/** Generic tabular report used for "Print" on every list view. */
export function ListReportPdf({ company, titleAr, titleEn, columns, rows, locale, enumLabel, printedBy, subtitle }: { company: PdfCompany; titleAr: string; titleEn: string; columns: ColumnDef[]; rows: Record<string, unknown>[]; locale: string; enumLabel?: (e: string, v: string) => string; printedBy?: string; subtitle?: string }) {
  const landscape = columns.length > 6;
  const width = `${(100 / Math.max(1, columns.length)).toFixed(2)}%`;
  const rtl = locale === "ar";
  const cols = rtl ? [...columns].reverse() : columns;
  return (
    <PdfFrame company={company} titleAr={titleAr} titleEn={titleEn} landscape={landscape} printedBy={printedBy} subtitle={subtitle ?? `${rows.length} ${rtl ? "سجل" : "records"}`}>
      <View style={pdfStyles.table}>
        <View style={[pdfStyles.tr, { backgroundColor: "#1e3a5f" }]} fixed>
          {cols.map((c) => (
            <Text key={c.key} style={[pdfStyles.th, { width, textAlign: c.align === "end" ? "right" : c.align === "center" ? "center" : rtl ? "right" : "left" }]}>
              {c.label}
            </Text>
          ))}
        </View>
        {rows.map((r, i) => (
          <View key={String(r.id ?? i)} style={[pdfStyles.tr, i % 2 ? { backgroundColor: "#f5f7fa" } : {}]} wrap={false}>
            {cols.map((c) => (
              <Text key={c.key} style={[pdfStyles.td, { width, textAlign: c.align === "end" || c.type === "money" || c.type === "number" ? "right" : c.align === "center" ? "center" : rtl ? "right" : "left" }]}>
                {fmt(c, cellValue(c, r, locale), enumLabel)}
              </Text>
            ))}
          </View>
        ))}
      </View>
    </PdfFrame>
  );
}
