import { z } from "zod";
import { prisma } from "@/lib/prisma";
import type { AppSession } from "@/core/auth/session";
import { D } from "@/lib/money";

export const budgetSchema = z.object({
  id: z.string().nullable().optional(),
  fiscalYearId: z.string().min(1),
  nameAr: z.string().min(1).max(120),
  nameEn: z.string().min(1).max(120),
  notes: z.string().max(1000).nullable().optional(),
  lines: z.array(z.object({ accountId: z.string().min(1), costCenterId: z.string().nullable().optional(), monthly: z.array(z.coerce.number()).length(12) })).default([]),
});
export type BudgetInput = z.infer<typeof budgetSchema>;

export async function listBudgets(session: AppSession) {
  const rows = await prisma.budget.findMany({ where: { companyId: session.companyId }, orderBy: { createdAt: "desc" }, include: { lines: { select: { annual: true } } } });
  const years = await prisma.fiscalYear.findMany({ where: { companyId: session.companyId }, select: { id: true, code: true, name: true } });
  return rows.map((b) => ({ ...b, year: years.find((y) => y.id === b.fiscalYearId)?.name ?? "", total: b.lines.reduce((a, l) => a.plus(l.annual), D(0)).toNumber(), lineCount: b.lines.length, lines: undefined }));
}

export async function getBudget(session: AppSession, id: string) {
  return prisma.budget.findFirst({ where: { id, companyId: session.companyId }, include: { lines: { include: { account: { select: { code: true, nameAr: true, nameEn: true, type: true } }, costCenter: { select: { code: true } } }, orderBy: { account: { code: "asc" } } } } });
}

export async function saveBudget(session: AppSession, input: BudgetInput) {
  const { id, lines, ...rest } = input;
  const seen = new Set<string>();
  const lineData = lines
    .filter((l) => {
      const k = `${l.accountId}|${l.costCenterId ?? ""}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .map((l) => ({ accountId: l.accountId, costCenterId: l.costCenterId || null, monthly: l.monthly, annual: l.monthly.reduce((a, v) => a + v, 0) }));
  return prisma.$transaction(async (tx) => {
    if (id) {
      const ex = await tx.budget.findFirst({ where: { id, companyId: session.companyId } });
      if (!ex) throw new Error("NOT_FOUND");
      await tx.budgetLine.deleteMany({ where: { budgetId: id } });
      return tx.budget.update({ where: { id }, data: { ...rest, lines: { create: lineData } } });
    }
    return tx.budget.create({ data: { ...rest, companyId: session.companyId, createdById: session.userId, lines: { create: lineData } } });
  });
}

export async function setBudgetStatus(session: AppSession, id: string, status: "DRAFT" | "APPROVED") {
  const ex = await prisma.budget.findFirst({ where: { id, companyId: session.companyId } });
  if (!ex) throw new Error("NOT_FOUND");
  return prisma.budget.update({ where: { id }, data: { status } });
}

export async function deleteBudget(session: AppSession, id: string) {
  const ex = await prisma.budget.findFirst({ where: { id, companyId: session.companyId } });
  if (!ex) throw new Error("NOT_FOUND");
  return prisma.budget.delete({ where: { id } });
}

/** Budget vs actual for months [fromMonth..toMonth] (1-based) of the budget's fiscal year. */
export async function varianceReport(session: AppSession, budgetId: string, fromMonth: number, toMonth: number, costCenterId?: string) {
  const b = await getBudget(session, budgetId);
  if (!b) throw new Error("NOT_FOUND");
  const fy = await prisma.fiscalYear.findUniqueOrThrow({ where: { id: b.fiscalYearId } });
  const y = fy.startDate.getUTCFullYear();
  const from = new Date(Date.UTC(y, fromMonth - 1, 1));
  const to = new Date(Date.UTC(y, toMonth, 0));
  const lines = b.lines.filter((l) => !costCenterId || l.costCenterId === costCenterId);
  const actuals = await prisma.journalLine.groupBy({
    by: ["accountId", "costCenterId"],
    where: { companyId: session.companyId, accountId: { in: lines.map((l) => l.accountId) }, entry: { status: "POSTED", entryDate: { gte: from, lte: to } }, ...(costCenterId ? { costCenterId } : {}) },
    _sum: { baseDebit: true, baseCredit: true },
  });
  return {
    budget: b,
    from, to,
    rows: lines.map((l) => {
      const monthly = l.monthly as number[];
      const budgetAmt = monthly.slice(fromMonth - 1, toMonth).reduce((a, v) => a + v, 0);
      const acts = actuals.filter((a) => a.accountId === l.accountId && (l.costCenterId ? a.costCenterId === l.costCenterId : true));
      const dr = acts.reduce((a, x) => a.plus(x._sum.baseDebit ?? 0), D(0));
      const cr = acts.reduce((a, x) => a.plus(x._sum.baseCredit ?? 0), D(0));
      const natural = l.account.type === "REVENUE" || l.account.type === "LIABILITY" || l.account.type === "EQUITY" ? cr.minus(dr) : dr.minus(cr);
      const actual = natural.toNumber();
      const variance = budgetAmt - actual;
      return { accountCode: l.account.code, accountNameAr: l.account.nameAr, accountNameEn: l.account.nameEn, type: l.account.type, costCenter: l.costCenter?.code ?? "", budget: budgetAmt, actual, variance, variancePct: budgetAmt ? (variance / budgetAmt) * 100 : 0 };
    }),
  };
}
