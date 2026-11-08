import ExcelJS from "exceljs";
import { cellValue, type ColumnDef } from "@/components/data-table/types";

/**
 * Builds an .xlsx buffer from rows + column definitions. Used by /api/export/[resource].
 */
export async function buildExcel(opts: {
  sheetName: string;
  title?: string;
  columns: ColumnDef[];
  rows: Record<string, unknown>[];
  locale: string;
  enumLabels?: (enumName: string, value: string) => string;
}): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Safina ERP";
  wb.created = new Date();
  const rtl = opts.locale === "ar";
  const ws = wb.addWorksheet(opts.sheetName.slice(0, 31), { views: [{ rightToLeft: rtl, state: "frozen", ySplit: opts.title ? 2 : 1 }] });

  let headerRow = 1;
  if (opts.title) {
    ws.mergeCells(1, 1, 1, Math.max(1, opts.columns.length));
    const c = ws.getCell(1, 1);
    c.value = opts.title;
    c.font = { bold: true, size: 14 };
    headerRow = 2;
  }

  ws.columns = opts.columns.map((c) => ({ key: c.key, width: c.type === "money" || c.type === "number" ? 16 : c.type === "date" ? 14 : 24 }));
  const hr = ws.getRow(headerRow);
  opts.columns.forEach((c, i) => {
    const cell = hr.getCell(i + 1);
    cell.value = c.label;
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E3A5F" } };
    cell.alignment = { vertical: "middle", horizontal: "center" };
  });

  for (const row of opts.rows) {
    const values = opts.columns.map((c) => {
      const v = cellValue(c, row, opts.locale);
      if (v === null || v === undefined) return null;
      if (c.type === "money" || c.type === "number") return Number(v);
      if (c.type === "date" || c.type === "datetime") return v instanceof Date ? v : new Date(String(v));
      if (c.type === "boolean") return v ? "✓" : "";
      if (c.type === "enum" && c.enumName && opts.enumLabels) return opts.enumLabels(c.enumName, String(v));
      if (typeof v === "object") return JSON.stringify(v);
      return v as string | number;
    });
    const r = ws.addRow(values);
    opts.columns.forEach((c, i) => {
      const cell = r.getCell(i + 1);
      if (c.type === "money") cell.numFmt = "#,##0.00";
      if (c.type === "number") cell.numFmt = "#,##0.##";
      if (c.type === "date") cell.numFmt = "yyyy-mm-dd";
      if (c.type === "datetime") cell.numFmt = "yyyy-mm-dd hh:mm";
    });
  }
  ws.autoFilter = { from: { row: headerRow, column: 1 }, to: { row: headerRow, column: Math.max(1, opts.columns.length) } };

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}

export function excelResponse(buffer: Buffer, fileName: string) {
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(fileName)}.xlsx"; filename*=UTF-8''${encodeURIComponent(fileName)}.xlsx`,
    },
  });
}
