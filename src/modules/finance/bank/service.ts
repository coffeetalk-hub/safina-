import { z } from "zod";
import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import type { AppSession } from "@/core/auth/session";
import type { ColumnDef } from "@/components/data-table/types";
import { makeCrud, zStr, zOptStr } from "@/modules/foundation/_shared/crud";
import { accountNetBalance } from "@/core/posting";
import { D } from "@/lib/money";

export const bankAccountSchema = z.object({
  id: z.string().nullable().optional(),
  code: zStr(20),
  nameAr: zStr(),
  nameEn: zStr(),
  bankName: zOptStr(120),
  accountNumber: zOptStr(40),
  iban: zOptStr(34),
  currencyCode: z.string().length(3).default("SAR"),
  accountId: z.string().min(1),
  isActive: z.coerce.boolean().default(true),
});

export const bankAccounts = makeCrud({
  model: "bankAccount",
  resource: "bank",
  schema: bankAccountSchema,
  searchFields: ["code", "nameAr", "nameEn", "bankName", "iban"],
  sortFields: ["code", "nameEn", "bankName"],
  defaultOrder: { code: "asc" },
  include: { account: { select: { code: true, nameAr: true, nameEn: true } } },
});

export function bankAccountColumns(tf: (k: string) => string, t: (k: string) => string): ColumnDef[] {
  return [
    { key: "code", label: tf("code"), sortable: true, type: "link", hrefTemplate: "/finance/bank/{id}" },
    { key: "name", label: tf("name"), bilingual: "name" },
    { key: "bankName", label: tf("bankName") },
    { key: "iban", label: tf("iban") },
    { key: "currencyCode", label: tf("currency"), align: "center" },
    { key: "account", label: t("account"), path: "account.code" },
    { key: "balance", label: t("glBalance"), type: "money", align: "end", currencyPath: "currencyCode" },
    { key: "isActive", label: tf("isActive"), type: "boolean", align: "center" },
  ];
}

/** Adds GL balance to each bank account row. */
export async function withBalances(session: AppSession, rows: { id: string; accountId: string }[]) {
  return Promise.all(rows.map(async (r) => ({ ...r, balance: (await accountNetBalance(session.companyId, r.accountId)).toNumber() })));
}

// ── Statement import

export async function importStatement(session: AppSession, bankAccountId: string, buf: Buffer, fileName: string) {
  const bank = await prisma.bankAccount.findFirst({ where: { id: bankAccountId, companyId: session.companyId } });
  if (!bank) throw new Error("NOT_FOUND");
  const rows: { lineDate: Date; description: string; reference: string | null; amount: number; balance: number | null }[] = [];
  if (fileName.toLowerCase().endsWith(".csv")) {
    const text = buf.toString("utf8");
    for (const [i, line] of text.split(/\r?\n/).entries()) {
      if (i === 0 || !line.trim()) continue;
      const cells = line.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
      const amount = cells[4] !== undefined && cells[4] !== "" ? Number(cells[3] || 0) * -1 + Number(cells[4] || 0) : Number(cells[3] || 0);
      rows.push({ lineDate: new Date(cells[0]), description: cells[1] ?? "", reference: cells[2] || null, amount, balance: cells[5] ? Number(cells[5]) : null });
    }
  } else {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf as unknown as ArrayBuffer);
    const ws = wb.worksheets[0];
    ws.eachRow((row, n) => {
      if (n === 1) return;
      const v = row.values as unknown[];
      const cell = (i: number) => {
        let x = v[i];
        if (x && typeof x === "object" && "result" in (x as object)) x = (x as { result: unknown }).result;
        if (x && typeof x === "object" && "text" in (x as object)) x = (x as { text: unknown }).text;
        return x;
      };
      const d = cell(1);
      if (!d) return;
      const debit = Number(cell(4) ?? 0);
      const credit = Number(cell(5) ?? 0);
      rows.push({ lineDate: d instanceof Date ? d : new Date(String(d)), description: String(cell(2) ?? ""), reference: cell(3) ? String(cell(3)) : null, amount: credit - debit, balance: cell(6) ? Number(cell(6)) : null });
    });
  }
  const valid = rows.filter((r) => !isNaN(r.lineDate.getTime()) && !isNaN(r.amount));
  const batch = `${Date.now()}`;
  await prisma.bankStatementLine.createMany({ data: valid.map((r) => ({ companyId: session.companyId, bankAccountId, importBatch: batch, ...r })) });
  return { imported: valid.length, skipped: rows.length - valid.length };
}

export async function statementTemplate(locale: string) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("statement", { views: [{ rightToLeft: locale === "ar" }] });
  ws.columns = [{ width: 14 }, { width: 40 }, { width: 18 }, { width: 14 }, { width: 14 }, { width: 14 }];
  const h = ws.addRow(locale === "ar" ? ["التاريخ", "البيان", "المرجع", "مدين (خارج)", "دائن (داخل)", "الرصيد"] : ["Date", "Description", "Reference", "Debit (out)", "Credit (in)", "Balance"]);
  h.font = { bold: true };
  ws.addRow([new Date(), "Customer transfer", "TRF-001", 0, 1150, 51150]);
  ws.addRow([new Date(), "Bank charges", "CHG", 25, 0, 51125]);
  return Buffer.from(await wb.xlsx.writeBuffer());
}

// ── Reconciliation

export async function reconciliationData(session: AppSession, bankAccountId: string, asOf: Date) {
  const bank = await prisma.bankAccount.findFirst({ where: { id: bankAccountId, companyId: session.companyId }, include: { account: true } });
  if (!bank) throw new Error("NOT_FOUND");
  const [stmt, gl, glBalance, reconciliations] = await Promise.all([
    prisma.bankStatementLine.findMany({ where: { companyId: session.companyId, bankAccountId, lineDate: { lte: asOf }, reconciliationId: null }, orderBy: { lineDate: "asc" } }),
    prisma.journalLine.findMany({ where: { companyId: session.companyId, accountId: bank.accountId, entry: { status: "POSTED", entryDate: { lte: asOf } }, NOT: { entry: { bankLines: { some: {} } } } }, include: { entry: { select: { id: true, number: true, entryDate: true, description: true, reference: true, source: true } } }, orderBy: { entry: { entryDate: "asc" } } }),
    accountNetBalance(session.companyId, bank.accountId, { to: asOf }),
    prisma.bankReconciliation.findMany({ where: { companyId: session.companyId, bankAccountId }, orderBy: { statementDate: "desc" }, take: 12 }),
  ]);
  const glRows = gl.map((l) => ({ id: l.entry.id, lineId: l.id, number: l.entry.number, date: l.entry.entryDate, description: l.entry.description ?? l.description, reference: l.entry.reference, source: l.entry.source, amount: D(l.baseDebit).minus(l.baseCredit).toNumber() }));
  return { bank, statement: stmt.map((s) => ({ ...s, amount: Number(s.amount), balance: s.balance == null ? null : Number(s.balance), matched: !!s.matchedEntryId })), gl: glRows, glBalance: glBalance.toNumber(), reconciliations };
}

export async function matchLine(session: AppSession, statementLineId: string, entryId: string | null) {
  const s = await prisma.bankStatementLine.findFirst({ where: { id: statementLineId, companyId: session.companyId } });
  if (!s) throw new Error("NOT_FOUND");
  if (s.reconciliationId) throw new Error("ALREADY_RECONCILED");
  return prisma.bankStatementLine.update({ where: { id: statementLineId }, data: { matchedEntryId: entryId } });
}

/** Auto-match statement lines with GL entries by exact amount within ±5 days. */
export async function autoMatch(session: AppSession, bankAccountId: string, asOf: Date) {
  const { statement, gl } = await reconciliationData(session, bankAccountId, asOf);
  const used = new Set<string>(statement.filter((s) => s.matchedEntryId).map((s) => s.matchedEntryId!));
  let n = 0;
  for (const s of statement.filter((x) => !x.matchedEntryId)) {
    const cand = gl.find((g) => !used.has(g.id) && Math.abs(g.amount - s.amount) < 0.005 && Math.abs(new Date(g.date).getTime() - new Date(s.lineDate).getTime()) <= 5 * 86_400_000);
    if (cand) {
      await prisma.bankStatementLine.update({ where: { id: s.id }, data: { matchedEntryId: cand.id } });
      used.add(cand.id);
      n++;
    }
  }
  return n;
}

export async function completeReconciliation(session: AppSession, input: { bankAccountId: string; statementDate: string; statementBalance: number; notes?: string | null }) {
  const asOf = new Date(input.statementDate);
  const { glBalance } = await reconciliationData(session, input.bankAccountId, asOf);
  return prisma.$transaction(async (tx) => {
    const rec = await tx.bankReconciliation.create({ data: { companyId: session.companyId, bankAccountId: input.bankAccountId, statementDate: asOf, statementBalance: input.statementBalance, glBalance, status: "COMPLETED", notes: input.notes ?? null, completedAt: new Date(), createdById: session.userId } });
    await tx.bankStatementLine.updateMany({ where: { companyId: session.companyId, bankAccountId: input.bankAccountId, lineDate: { lte: asOf }, reconciliationId: null, matchedEntryId: { not: null } }, data: { reconciliationId: rec.id } });
    return rec;
  });
}

export async function deleteStatementLine(session: AppSession, id: string) {
  const s = await prisma.bankStatementLine.findFirst({ where: { id, companyId: session.companyId } });
  if (!s) throw new Error("NOT_FOUND");
  if (s.reconciliationId) throw new Error("ALREADY_RECONCILED");
  return prisma.bankStatementLine.delete({ where: { id } });
}
