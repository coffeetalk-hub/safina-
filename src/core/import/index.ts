import ExcelJS from "exceljs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import type { AppSession } from "@/core/auth/session";
import { runWithContext } from "@/core/context";

export type ImportColumn = { key: string; labelAr: string; labelEn: string; required?: boolean; example?: string };

export type ImportDefinition = {
  entity: string;
  permission: string;
  columns: ImportColumn[];
  rowSchema: z.ZodTypeAny;
  /** Persist one validated row. Throw to report a row error. */
  upsert: (session: AppSession, row: Record<string, unknown>, ctx: Map<string, unknown>) => Promise<void>;
  /** Optional preload (e.g. lookup maps) shared across rows */
  prepare?: (session: AppSession) => Promise<Map<string, unknown>>;
};

export async function buildTemplate(def: ImportDefinition, locale: string): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(def.entity, { views: [{ rightToLeft: locale === "ar", state: "frozen", ySplit: 1 }] });
  ws.columns = def.columns.map((c) => ({ key: c.key, width: 22 }));
  const header = ws.addRow(def.columns.map((c) => `${locale === "ar" ? c.labelAr : c.labelEn}${c.required ? " *" : ""}`));
  header.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E3A5F" } };
  });
  // Hidden technical key row helps mapping regardless of display language
  const keys = ws.addRow(def.columns.map((c) => c.key));
  keys.hidden = true;
  keys.eachCell((cell) => (cell.font = { color: { argb: "FF999999" }, size: 8 }));
  ws.addRow(def.columns.map((c) => c.example ?? ""));
  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}

export type ImportResult = { total: number; ok: number; failed: number; errors: { row: number; message: string }[] };

export async function runImport(def: ImportDefinition, session: AppSession, fileBuffer: Buffer, fileName: string): Promise<ImportResult> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(fileBuffer as unknown as ArrayBuffer);
  const ws = wb.worksheets[0];
  if (!ws) throw new Error("INVALID_FILE");

  // Find the key row (row 2 if hidden technical keys exist, else map by header label)
  const row2 = ws.getRow(2).values as unknown[];
  const keyRowIsKeys = def.columns.every((c, i) => String(row2[i + 1] ?? "") === c.key);
  const keys = keyRowIsKeys
    ? def.columns.map((c) => c.key)
    : (ws.getRow(1).values as unknown[]).slice(1).map((label) => {
        const l = String(label ?? "").replace(/\s*\*$/, "").trim();
        return def.columns.find((c) => c.labelAr === l || c.labelEn === l || c.key === l)?.key ?? "";
      });
  const startRow = keyRowIsKeys ? 3 : 2;
  const ctx = def.prepare ? await def.prepare(session) : new Map<string, unknown>();
  const result: ImportResult = { total: 0, ok: 0, failed: 0, errors: [] };

  for (let r = startRow; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const values = row.values as unknown[];
    if (!values || values.slice(1).every((v) => v === null || v === undefined || String(v).trim() === "")) continue;
    result.total++;
    const obj: Record<string, unknown> = {};
    keys.forEach((k, i) => {
      if (!k) return;
      let v = values[i + 1];
      if (v && typeof v === "object" && "result" in (v as object)) v = (v as { result: unknown }).result; // formula cells
      if (v && typeof v === "object" && "text" in (v as object)) v = (v as { text: unknown }).text; // rich text / hyperlink
      if (v instanceof Date) v = v.toISOString().slice(0, 10);
      obj[k] = typeof v === "string" ? v.trim() : v;
    });
    const parsed = def.rowSchema.safeParse(obj);
    if (!parsed.success) {
      result.failed++;
      result.errors.push({ row: r, message: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") });
      continue;
    }
    try {
      await runWithContext({ userId: session.userId, companyId: session.companyId }, () => def.upsert(session, parsed.data as Record<string, unknown>, ctx));
      result.ok++;
    } catch (e) {
      result.failed++;
      result.errors.push({ row: r, message: e instanceof Error ? e.message : String(e) });
    }
  }
  await prisma.importJob.create({ data: { companyId: session.companyId, entityType: def.entity, fileName, totalRows: result.total, successRows: result.ok, errorRows: result.failed, errors: result.errors.slice(0, 500), createdById: session.userId } });
  return result;
}
