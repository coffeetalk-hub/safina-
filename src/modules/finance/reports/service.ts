import { prisma } from "@/lib/prisma";
import type { AppSession } from "@/core/auth/session";
import { D, ZERO } from "@/lib/money";

export type ReportFilter = { from: Date; to: Date; branchId?: string | null; costCenterId?: string | null };

type AccRow = { id: string; code: string; nameAr: string; nameEn: string; type: string; level: number; parentId: string | null };

async function accounts(companyId: string): Promise<AccRow[]> {
  return prisma.account.findMany({ where: { companyId }, orderBy: { code: "asc" }, select: { id: true, code: true, nameAr: true, nameEn: true, type: true, level: true, parentId: true } });
}

/** Sum of posted lines per account between dates (and optionally opening before `from`). */
async function sums(companyId: string, f: ReportFilter, mode: "period" | "opening" | "cumulative") {
  const entryDate = mode === "period" ? { gte: f.from, lte: f.to } : mode === "opening" ? { lt: f.from } : { lte: f.to };
  const rows = await prisma.journalLine.groupBy({
    by: ["accountId"],
    where: { companyId, costCenterId: f.costCenterId || undefined, entry: { status: "POSTED", branchId: f.branchId || undefined, entryDate } },
    _sum: { baseDebit: true, baseCredit: true },
  });
  const m = new Map<string, { debit: ReturnType<typeof D>; credit: ReturnType<typeof D> }>();
  for (const r of rows) m.set(r.accountId, { debit: D(r._sum.baseDebit ?? 0), credit: D(r._sum.baseCredit ?? 0) });
  return m;
}

export type TbRow = { id: string; code: string; nameAr: string; nameEn: string; type: string; level: number; openingDebit: number; openingCredit: number; debit: number; credit: number; closingDebit: number; closingCredit: number };

/** Trial balance with opening, period movement and closing per postable account (+ parent subtotals). */
export async function trialBalance(session: AppSession, f: ReportFilter) {
  const [accs, opening, period] = await Promise.all([accounts(session.companyId), sums(session.companyId, f, "opening"), sums(session.companyId, f, "period")]);
  const rows: TbRow[] = [];
  for (const a of accs) {
    const o = opening.get(a.id) ?? { debit: ZERO, credit: ZERO };
    const p = period.get(a.id) ?? { debit: ZERO, credit: ZERO };
    const openNet = o.debit.minus(o.credit);
    const closeNet = openNet.plus(p.debit).minus(p.credit);
    if (openNet.isZero() && p.debit.isZero() && p.credit.isZero()) continue;
    rows.push({ ...a, openingDebit: openNet.gt(0) ? openNet.toNumber() : 0, openingCredit: openNet.lt(0) ? openNet.abs().toNumber() : 0, debit: p.debit.toNumber(), credit: p.credit.toNumber(), closingDebit: closeNet.gt(0) ? closeNet.toNumber() : 0, closingCredit: closeNet.lt(0) ? closeNet.abs().toNumber() : 0 });
  }
  const totals = rows.reduce((t, r) => ({ openingDebit: t.openingDebit + r.openingDebit, openingCredit: t.openingCredit + r.openingCredit, debit: t.debit + r.debit, credit: t.credit + r.credit, closingDebit: t.closingDebit + r.closingDebit, closingCredit: t.closingCredit + r.closingCredit }), { openingDebit: 0, openingCredit: 0, debit: 0, credit: 0, closingDebit: 0, closingCredit: 0 });
  return { rows, totals };
}

export type StmtLine = { code: string; nameAr: string; nameEn: string; level: number; amount: number; isHeader: boolean; isTotal?: boolean };

/** Builds a hierarchical statement section for the given account types using natural balances. */
function section(accs: AccRow[], m: Map<string, { debit: ReturnType<typeof D>; credit: ReturnType<typeof D> }>, types: string[], creditNatural: boolean): { lines: StmtLine[]; total: number } {
  const byParent = new Map<string | null, AccRow[]>();
  for (const a of accs.filter((x) => types.includes(x.type))) byParent.set(a.parentId, [...(byParent.get(a.parentId) ?? []), a]);
  const amountOf = (a: AccRow): number => {
    const s = m.get(a.id);
    const own = s ? (creditNatural ? s.credit.minus(s.debit) : s.debit.minus(s.credit)).toNumber() : 0;
    const kids = byParent.get(a.id) ?? [];
    return own + kids.reduce((t, k) => t + amountOf(k), 0);
  };
  const lines: StmtLine[] = [];
  const walk = (parentId: string | null) => {
    for (const a of byParent.get(parentId) ?? []) {
      const amt = amountOf(a);
      const kids = byParent.get(a.id) ?? [];
      if (amt === 0 && kids.length === 0) continue;
      lines.push({ code: a.code, nameAr: a.nameAr, nameEn: a.nameEn, level: a.level, amount: amt, isHeader: kids.length > 0 });
      walk(a.id);
    }
  };
  walk(null);
  const roots = (byParent.get(null) ?? []).filter((a) => types.includes(a.type));
  return { lines, total: roots.reduce((t, a) => t + amountOf(a), 0) };
}

export async function profitLoss(session: AppSession, f: ReportFilter) {
  const [accs, m] = await Promise.all([accounts(session.companyId), sums(session.companyId, f, "period")]);
  const revenue = section(accs, m, ["REVENUE"], true);
  const expenses = section(accs, m, ["EXPENSE"], false);
  return { revenue, expenses, netIncome: revenue.total - expenses.total };
}

export async function balanceSheet(session: AppSession, f: ReportFilter) {
  const [accs, m] = await Promise.all([accounts(session.companyId), sums(session.companyId, f, "cumulative")]);
  const assets = section(accs, m, ["ASSET"], false);
  const liabilities = section(accs, m, ["LIABILITY"], true);
  const equity = section(accs, m, ["EQUITY"], true);
  // current-period earnings not yet closed to retained earnings
  const rev = section(accs, m, ["REVENUE"], true).total;
  const exp = section(accs, m, ["EXPENSE"], false).total;
  const earnings = rev - exp;
  return { assets, liabilities, equity, earnings, totalLiabilitiesEquity: liabilities.total + equity.total + earnings, asOf: f.to };
}

/** Cash flow (direct, by source of cash movements) over the period. */
export async function cashFlow(session: AppSession, f: ReportFilter) {
  const banks = await prisma.bankAccount.findMany({ where: { companyId: session.companyId }, select: { accountId: true } });
  const funds = await prisma.pettyCashFund.findMany({ where: { companyId: session.companyId }, select: { accountId: true } });
  const mapped = await prisma.accountMapping.findMany({ where: { companyId: session.companyId, key: { in: ["CASH", "BANK_DEFAULT", "PETTY_CASH"] } } });
  const cashIds = [...new Set([...banks.map((b) => b.accountId), ...funds.map((x) => x.accountId), ...mapped.map((x) => x.accountId)])];
  const where = (entryDate: { gte?: Date; lte?: Date; lt?: Date }) => ({ companyId: session.companyId, accountId: { in: cashIds }, costCenterId: f.costCenterId || undefined, entry: { status: "POSTED" as const, branchId: f.branchId || undefined, entryDate } });
  const [opening, lines] = await Promise.all([
    prisma.journalLine.aggregate({ where: where({ lt: f.from }), _sum: { baseDebit: true, baseCredit: true } }),
    prisma.journalLine.findMany({ where: where({ gte: f.from, lte: f.to }), include: { entry: { select: { source: true, description: true, lines: { select: { accountId: true, account: { select: { type: true, code: true } } } } } } } }),
  ]);
  const buckets: Record<string, Record<string, number>> = { operating: {}, investing: {}, financing: {} };
  for (const l of lines) {
    const amt = D(l.baseDebit).minus(l.baseCredit).toNumber();
    const counter = l.entry.lines.filter((x) => !cashIds.includes(x.accountId));
    const touchesEquityOrLoan = counter.some((x) => x.account.type === "EQUITY" || x.account.code.startsWith("22"));
    const touchesAsset = l.entry.source === "ASSET" || counter.some((x) => x.account.code.startsWith("12"));
    const bucket = touchesEquityOrLoan ? "financing" : touchesAsset ? "investing" : "operating";
    const key = l.entry.source === "AR_RECEIPT" ? "receiptsFromCustomers" : l.entry.source === "AP_PAYMENT" ? "paymentsToVendors" : l.entry.source === "PAYROLL" ? "payroll" : l.entry.source === "PETTY_CASH" ? "pettyCash" : l.entry.source === "ASSET" ? "fixedAssets" : touchesEquityOrLoan ? "equityAndLoans" : "other";
    buckets[bucket][key] = (buckets[bucket][key] ?? 0) + amt;
  }
  const sum = (b: Record<string, number>) => Object.values(b).reduce((a, v) => a + v, 0);
  const openingBal = D(opening._sum.baseDebit ?? 0).minus(D(opening._sum.baseCredit ?? 0)).toNumber();
  const net = sum(buckets.operating) + sum(buckets.investing) + sum(buckets.financing);
  return { opening: openingBal, operating: buckets.operating, investing: buckets.investing, financing: buckets.financing, netChange: net, closing: openingBal + net };
}

/** General ledger for one account. */
export async function accountLedger(session: AppSession, accountId: string, f: ReportFilter) {
  const [opening, lines] = await Promise.all([
    prisma.journalLine.aggregate({ where: { companyId: session.companyId, accountId, costCenterId: f.costCenterId || undefined, entry: { status: "POSTED", branchId: f.branchId || undefined, entryDate: { lt: f.from } } }, _sum: { baseDebit: true, baseCredit: true } }),
    prisma.journalLine.findMany({ where: { companyId: session.companyId, accountId, costCenterId: f.costCenterId || undefined, entry: { status: "POSTED", branchId: f.branchId || undefined, entryDate: { gte: f.from, lte: f.to } } }, include: { entry: { select: { id: true, number: true, entryDate: true, description: true, reference: true, source: true } }, costCenter: { select: { code: true } } }, orderBy: [{ entry: { entryDate: "asc" } }, { entry: { number: "asc" } }, { lineNo: "asc" }] }),
  ]);
  let bal = D(opening._sum.baseDebit ?? 0).minus(D(opening._sum.baseCredit ?? 0));
  const openingBal = bal.toNumber();
  const rows = lines.map((l) => {
    bal = bal.plus(l.baseDebit).minus(l.baseCredit);
    return { id: l.id, entryId: l.entry.id, number: l.entry.number, date: l.entry.entryDate, description: l.description ?? l.entry.description, reference: l.entry.reference, source: l.entry.source, costCenter: l.costCenter?.code ?? "", debit: Number(l.baseDebit), credit: Number(l.baseCredit), balance: bal.toNumber() };
  });
  return { opening: openingBal, rows, closing: bal.toNumber() };
}
