/** Payroll runs: calculate payslips from salary structures + attendance + leave + loans, GOSI, approval, GL posting, payment and WPS file. */
import { z } from "zod";
import { prisma, type Tx } from "@/lib/prisma";
import type { AppSession } from "@/core/auth/session";
import { orderByFrom, skipTake, type ColumnDef, type ListParams, type PagedResult } from "@/components/data-table/types";
import { nextDocumentNumber } from "@/core/numbering";
import { submitForApproval } from "@/core/approvals/engine";
import { registerApprovalHooks, DOC_LINKS } from "@/modules/foundation/approvals/hooks";
import { postJournal, mappedAccount, type PostingLine } from "@/core/posting";
import { D, round } from "@/lib/money";
import type { Prisma } from "@prisma/client";
import { computeGosi, dailyWage, overtimePay, sickPayFraction } from "./rules";
import { getHrSettings, gosiRatesFor } from "./settings";
import { resolveSalary, empName, allowedEmployeeIds } from "./employees";
import { monthSummary } from "./attendance";
import { dueInstallments, settleInstallments } from "./loans";

export const runSchema = z.object({ periodYear: z.coerce.number().int().min(2000).max(2100), periodMonth: z.coerce.number().int().min(1).max(12), payDate: z.string().min(10), branchId: z.string().nullable().optional(), notes: z.string().max(1000).nullable().optional() });

function where(session: AppSession, p: ListParams) {
  const w: Record<string, unknown> = { companyId: session.companyId };
  if (p.filters.status) w.status = p.filters.status;
  if (p.filters.year) w.periodYear = Number(p.filters.year);
  if (p.q) w.number = { contains: p.q, mode: "insensitive" };
  return w;
}
export async function listRuns(session: AppSession, p: ListParams): Promise<PagedResult<Record<string, unknown>>> {
  const w = where(session, p);
  const [rows, total] = await Promise.all([prisma.payrollRun.findMany({ where: w, orderBy: orderByFrom(p.sort, ["number", "periodYear", "payDate", "totalNet", "status"], { payDate: "desc" }), ...skipTake(p) }), prisma.payrollRun.count({ where: w })]);
  return { rows: rows.map((r) => ({ ...r, period: `${r.periodYear}-${String(r.periodMonth).padStart(2, "0")}` })), total, page: p.page, pageSize: p.pageSize };
}
export async function allRuns(session: AppSession, p: ListParams) { return (await prisma.payrollRun.findMany({ where: where(session, p), orderBy: { payDate: "desc" }, take: 1000 })).map((r) => ({ ...r, period: `${r.periodYear}-${String(r.periodMonth).padStart(2, "0")}` })); }
export async function getRun(session: AppSession, id: string) {
  const run = await prisma.payrollRun.findFirst({ where: { id, companyId: session.companyId }, include: { payslips: { include: { lines: { orderBy: { sortOrder: "asc" } } }, orderBy: { number: "asc" } }, wpsFile: { select: { id: true, fileName: true, records: true, totalAmount: true, generatedAt: true } } } });
  if (!run) return null;
  const emps = await prisma.employee.findMany({ where: { id: { in: run.payslips.map((p) => p.employeeId) } }, select: { id: true, code: true, firstNameAr: true, lastNameAr: true, firstNameEn: true, lastNameEn: true, department: true, isSaudi: true } });
  const [journal, payment] = await Promise.all([run.journalEntryId ? prisma.journalEntry.findUnique({ where: { id: run.journalEntryId }, select: { id: true, number: true } }) : null, run.paymentEntryId ? prisma.journalEntry.findUnique({ where: { id: run.paymentEntryId }, select: { id: true, number: true } }) : null]);
  return { ...run, journal, payment, payslips: run.payslips.map((p) => { const e = emps.find((x) => x.id === p.employeeId); return { ...p, employeeCode: e?.code ?? "", employeeAr: e ? empName(e).nameAr : "", employeeEn: e ? empName(e).nameEn : "", department: e?.department ?? "", isSaudi: e?.isSaudi ?? true }; }) };
}
export async function createRun(session: AppSession, input: z.infer<typeof runSchema>) {
  const dup = await prisma.payrollRun.findFirst({ where: { companyId: session.companyId, periodYear: input.periodYear, periodMonth: input.periodMonth, branchId: input.branchId || null, status: { not: "CANCELLED" } } });
  if (dup) throw new Error("PAYROLL_EXISTS");
  return prisma.$transaction(async (tx) => {
    const number = await nextDocumentNumber(tx, session.companyId, "PAYROLL", new Date(input.payDate));
    const run = await tx.payrollRun.create({ data: { companyId: session.companyId, number, periodYear: input.periodYear, periodMonth: input.periodMonth, payDate: new Date(input.payDate), branchId: input.branchId || null, notes: input.notes ?? null, createdById: session.userId } });
    return run;
  });
}

/** (Re)calculate every payslip of a DRAFT/CALCULATED run. */
export async function calculateRun(session: AppSession, id: string) {
  const run = await prisma.payrollRun.findFirst({ where: { id, companyId: session.companyId } });
  if (!run || !["DRAFT", "CALCULATED"].includes(run.status)) throw new Error("NOT_DRAFT");
  const { periodYear: y, periodMonth: m } = run;
  const from = new Date(Date.UTC(y, m - 1, 1)); const to = new Date(Date.UTC(y, m, 0)); const dim = to.getUTCDate();
  const s = await getHrSettings(session.companyId);
  const [emps, att, leaves, holidays] = await Promise.all([
    prisma.employee.findMany({ where: { companyId: session.companyId, status: { in: ["ACTIVE", "ON_LEAVE", "TERMINATED"] }, branchId: run.branchId ?? undefined, OR: [{ hireDate: null }, { hireDate: { lte: to } }], AND: [{ OR: [{ terminationDate: null }, { terminationDate: { gte: from } }] }] } }),
    monthSummary(session.companyId, y, m),
    prisma.leaveRequest.findMany({ where: { companyId: session.companyId, status: "APPROVED", startDate: { lte: to }, endDate: { gte: new Date(Date.UTC(y, 0, 1)) } }, include: { leaveType: true } }),
    prisma.publicHoliday.count({ where: { companyId: session.companyId, date: { gte: from, lte: to } } }),
  ]);
  void holidays;
  const structures = await prisma.salaryStructure.findMany({ where: { companyId: session.companyId, employeeId: { in: emps.map((e) => e.id) } }, include: { lines: { include: { component: true } } } });
  const rates = { saudi: await gosiRatesFor(session.companyId, true, to), nonSaudi: await gosiRatesFor(session.companyId, false, to) };
  const dayList = (a: Date, b: Date) => { const out: Date[] = []; for (let d = new Date(Math.max(a.getTime(), from.getTime())); d <= b && d <= to; d.setUTCDate(d.getUTCDate() + 1)) out.push(new Date(d)); return out; };

  return prisma.$transaction(async (tx) => {
    await tx.payslip.deleteMany({ where: { runId: id } });
    let tE = D(0), tD = D(0), tN = D(0), tGe = D(0), tGr = D(0), tL = D(0), count = 0;
    for (const e of emps) {
      const st = structures.find((x) => x.employeeId === e.id);
      if (!st) continue;
      const sal = resolveSalary(st);
      // pro-rata for joiners / leavers within the month
      let factor = 1;
      if (e.hireDate && e.hireDate > from) factor -= (e.hireDate.getUTCDate() - 1) / dim;
      if (e.terminationDate && e.terminationDate < to) factor -= (dim - e.terminationDate.getUTCDate()) / dim;
      factor = Math.max(0, Math.min(1, factor));
      const basic = round(D(sal.basic).times(factor), 2);
      const earnLines = sal.earnings.map((l) => ({ ...l, amount: round(D(l.amount).times(factor), 2) }));
      const fixedEarnings = basic.plus(earnLines.reduce((a, l) => a.plus(l.amount), D(0)));
      const dw = dailyWage(fixedEarnings.toNumber(), s.daysPerMonth);
      // attendance
      const a = att.get(e.id) ?? { present: 0, absent: 0, leave: 0, remote: 0, overtimeHrs: 0, lateMin: 0 };
      const ot = overtimePay(a.overtimeHrs, basic.toNumber(), s.daysPerMonth, Number(s.dailyHours), Number(s.overtimeMultiplier));
      // leave: unpaid days + partially paid sick days inside the month
      let unpaidDays = 0, sickEquivalent = 0;
      const mine = leaves.filter((l) => l.employeeId === e.id);
      const sickBefore = (d: Date) => mine.filter((l) => l.leaveType.code === "SICK").reduce((n, l) => n + dayList(l.startDate, new Date(Math.min(l.endDate.getTime(), d.getTime() - 86_400_000))).length + (l.startDate < from ? Math.max(0, Math.min(l.endDate.getTime(), from.getTime() - 86_400_000) - l.startDate.getTime()) / 86_400_000 + 1 : 0), 0);
      for (const l of mine) {
        const days = dayList(l.startDate, l.endDate);
        if (!l.leaveType.isPaid) unpaidDays += days.length;
        else if (l.leaveType.code === "SICK") { let idx = Math.floor(sickBefore(days[0] ?? from)); for (const _d of days) { void _d; sickEquivalent += 1 - sickPayFraction(idx, s.sickFullPayDays, s.sickPartialPayDays, s.sickPartialPayPct); idx++; } }
        else if (l.leaveType.payPct < 100) sickEquivalent += days.length * (1 - l.leaveType.payPct / 100);
      }
      const absence = round(D(dw).times(a.absent + unpaidDays + sickEquivalent), 2);
      // GOSI
      const housing = earnLines.filter((l) => l.isHousing).reduce((x, l) => x.plus(l.amount), D(0));
      const gosiBase = s.gosiWageBasis === "BASIC" ? basic : s.gosiWageBasis === "FULL" ? fixedEarnings : basic.plus(housing);
      const g = computeGosi(e.isSaudi, gosiBase.toNumber(), e.isSaudi ? rates.saudi : rates.nonSaudi, Number(s.gosiMinWage), Number(s.gosiMaxWage));
      // loans
      const insts = await dueInstallments(tx, session.companyId, e.id, y, m);
      const loan = insts.reduce((x, i) => x.plus(i.amount), D(0));
      const dedLines = sal.deductions;
      const totalEarnings = fixedEarnings.plus(ot);
      const totalDeductions = D(sal.fixedDeductions).plus(g.employee).plus(loan).plus(absence);
      const net = round(totalEarnings.minus(totalDeductions), 2);
      const number = await nextDocumentNumber(tx, session.companyId, "PAYSLIP", run.payDate);
      const slip = await tx.payslip.create({ data: {
        runId: id, companyId: session.companyId, employeeId: e.id, costCenterId: e.costCenterId, number, basic, totalEarnings, totalDeductions, net, gosiWage: g.wage, gosiEmployee: g.employee, gosiEmployer: g.employer, loanDeduction: loan, absenceDeduction: absence, overtimePay: ot, workingDays: s.daysPerMonth, absentDays: a.absent, unpaidLeaveDays: unpaidDays, overtimeHrs: a.overtimeHrs, paymentMethod: st.paymentMethod, bankName: e.bankName, iban: e.iban,
        lines: { create: [
          { code: "BASIC", nameAr: "الراتب الأساسي", nameEn: "Basic salary", type: "EARNING", amount: basic, sortOrder: 0 },
          ...earnLines.map((l, i) => ({ code: l.code, nameAr: l.nameAr, nameEn: l.nameEn, type: "EARNING" as const, amount: l.amount, sortOrder: i + 1 })),
          ...(ot > 0 ? [{ code: "OVERTIME", nameAr: `عمل إضافي (${a.overtimeHrs} س)`, nameEn: `Overtime (${a.overtimeHrs} h)`, type: "EARNING" as const, amount: ot, sortOrder: 50 }] : []),
          ...dedLines.map((l, i) => ({ code: l.code, nameAr: l.nameAr, nameEn: l.nameEn, type: "DEDUCTION" as const, amount: l.amount, sortOrder: 100 + i })),
          ...(g.employee > 0 ? [{ code: "GOSI", nameAr: `التأمينات الاجتماعية (${g.employeePct}%)`, nameEn: `GOSI employee (${g.employeePct}%)`, type: "DEDUCTION" as const, amount: g.employee, sortOrder: 150 }] : []),
          ...(loan.gt(0) ? [{ code: "LOAN", nameAr: "قسط سلفة", nameEn: "Loan installment", type: "DEDUCTION" as const, amount: loan, sortOrder: 160 }] : []),
          ...(absence.gt(0) ? [{ code: "ABSENCE", nameAr: `خصم غياب/إجازة غير مدفوعة (${a.absent + unpaidDays}${sickEquivalent ? ` + مرضي ${sickEquivalent.toFixed(2)}` : ""} يوم)`, nameEn: `Absence / unpaid leave (${a.absent + unpaidDays}${sickEquivalent ? ` + sick ${sickEquivalent.toFixed(2)}` : ""} days)`, type: "DEDUCTION" as const, amount: absence, sortOrder: 170 }] : []),
        ] },
      } });
      void slip;
      tE = tE.plus(totalEarnings); tD = tD.plus(totalDeductions); tN = tN.plus(net); tGe = tGe.plus(g.employee); tGr = tGr.plus(g.employer); tL = tL.plus(loan); count++;
    }
    return tx.payrollRun.update({ where: { id }, data: { status: "CALCULATED", employeesCount: count, totalEarnings: tE, totalDeductions: tD, totalNet: tN, totalGosiEmployee: tGe, totalGosiEmployer: tGr, totalLoans: tL, updatedById: session.userId } });
  }, { timeout: 60_000 });
}
export async function submitRun(session: AppSession, id: string) {
  return prisma.$transaction(async (tx) => {
    const run = await tx.payrollRun.findFirst({ where: { id, companyId: session.companyId } });
    if (!run || run.status !== "CALCULATED") throw new Error("INVALID_TRANSITION");
    const req = await submitForApproval(tx, { companyId: session.companyId, docType: "PAYROLL", docId: run.id, docNumber: run.number, amount: run.totalNet, requestedById: session.userId, link: `/hr/payroll/${run.id}` });
    await tx.payrollRun.update({ where: { id }, data: { status: req ? "PENDING_APPROVAL" : "APPROVED", updatedById: session.userId } });
    return { status: req ? "PENDING_APPROVAL" : "APPROVED" };
  });
}
/** Post the payroll journal (per cost center) and settle loan installments. */
export async function postRun(session: AppSession, id: string) {
  return prisma.$transaction(async (tx) => {
    const run = await tx.payrollRun.findFirst({ where: { id, companyId: session.companyId }, include: { payslips: { include: { lines: true } } } });
    if (!run || run.status !== "APPROVED") throw new Error("INVALID_TRANSITION");
    const acc = async (k: string) => mappedAccount(tx, session.companyId, k);
    const [salExp, salPay, gosiExp, gosiPay, loans] = await Promise.all([acc("SALARIES_EXPENSE"), acc("SALARIES_PAYABLE"), acc("GOSI_EXPENSE"), acc("GOSI_PAYABLE"), acc("EMPLOYEE_LOANS")]);
    const components = await tx.payComponent.findMany({ where: { companyId: session.companyId } });
    const lines: PostingLine[] = [];
    const byCc = new Map<string | null, { exp: Prisma.Decimal; gosiEr: Prisma.Decimal }>();
    const compCredits = new Map<string, Prisma.Decimal>();
    let gosiTotal = D(0), loanTotal = D(0), netTotal = D(0);
    for (const p of run.payslips) {
      const dedNoAcct = p.lines.filter((l) => l.type === "DEDUCTION" && !["GOSI", "LOAN", "ABSENCE"].includes(l.code)).reduce((a, l) => { const c = components.find((x) => x.code === l.code); if (c?.accountId) { compCredits.set(c.accountId, (compCredits.get(c.accountId) ?? D(0)).plus(l.amount)); return a; } return a.plus(l.amount); }, D(0));
      const exp = D(p.totalEarnings).minus(p.absenceDeduction).minus(dedNoAcct);
      const cc = byCc.get(p.costCenterId) ?? { exp: D(0), gosiEr: D(0) };
      cc.exp = cc.exp.plus(exp); cc.gosiEr = cc.gosiEr.plus(p.gosiEmployer); byCc.set(p.costCenterId, cc);
      gosiTotal = gosiTotal.plus(p.gosiEmployee).plus(p.gosiEmployer); loanTotal = loanTotal.plus(p.loanDeduction); netTotal = netTotal.plus(p.net);
      const insts = await dueInstallments(tx, session.companyId, p.employeeId, run.periodYear, run.periodMonth);
      await settleInstallments(tx, insts.map((i) => i.id), p.id);
    }
    const period = `${run.periodYear}-${String(run.periodMonth).padStart(2, "0")}`;
    for (const [cc, v] of byCc) { if (v.exp.gt(0)) lines.push({ accountId: salExp, costCenterId: cc, debit: v.exp, description: `Salaries ${period}` }); if (v.gosiEr.gt(0)) lines.push({ accountId: gosiExp, costCenterId: cc, debit: v.gosiEr, description: `GOSI employer ${period}` }); }
    if (gosiTotal.gt(0)) lines.push({ accountId: gosiPay, credit: gosiTotal, description: `GOSI payable ${period}` });
    if (loanTotal.gt(0)) lines.push({ accountId: loans, credit: loanTotal, description: `Loan installments ${period}` });
    for (const [a, v] of compCredits) lines.push({ accountId: a, credit: v, description: `Payroll deductions ${period}` });
    lines.push({ accountId: salPay, credit: netTotal, description: `Net salaries payable ${period}` });
    const j = await postJournal(tx, { companyId: session.companyId, branchId: run.branchId, entryDate: run.payDate, description: `Payroll ${run.number} — ${period} / رواتب ${period}`, reference: run.number, source: "PAYROLL", sourceType: "PayrollRun", sourceId: run.id, userId: session.userId, lines });
    return tx.payrollRun.update({ where: { id }, data: { status: "POSTED", journalEntryId: j.id, updatedById: session.userId } });
  }, { timeout: 60_000 });
}
/** Pay: Dr Salaries payable Cr Bank (bank-transfer slips) / Cash (cash slips). */
export async function payRun(session: AppSession, id: string) {
  return prisma.$transaction(async (tx) => {
    const run = await tx.payrollRun.findFirst({ where: { id, companyId: session.companyId }, include: { payslips: true } });
    if (!run || run.status !== "POSTED") throw new Error("INVALID_TRANSITION");
    const [salPay, bank, cash] = await Promise.all([mappedAccount(tx, session.companyId, "SALARIES_PAYABLE"), mappedAccount(tx, session.companyId, "BANK_DEFAULT"), mappedAccount(tx, session.companyId, "CASH")]);
    const bankNet = run.payslips.filter((p) => p.paymentMethod !== "CASH").reduce((a, p) => a.plus(p.net), D(0));
    const cashNet = run.payslips.filter((p) => p.paymentMethod === "CASH").reduce((a, p) => a.plus(p.net), D(0));
    const lines: PostingLine[] = [{ accountId: salPay, debit: run.totalNet }];
    if (bankNet.gt(0)) lines.push({ accountId: bank, credit: bankNet, description: "WPS transfer" });
    if (cashNet.gt(0)) lines.push({ accountId: cash, credit: cashNet, description: "Cash salaries" });
    const j = await postJournal(tx, { companyId: session.companyId, branchId: run.branchId, entryDate: run.payDate, description: `Salary payment ${run.number} / صرف رواتب`, reference: run.number, source: "PAYROLL", sourceType: "PayrollRun", sourceId: run.id, userId: session.userId, lines });
    return tx.payrollRun.update({ where: { id }, data: { status: "PAID", paymentEntryId: j.id, updatedById: session.userId } });
  });
}
export async function cancelRun(session: AppSession, id: string) {
  const run = await prisma.payrollRun.findFirst({ where: { id, companyId: session.companyId } });
  if (!run || !["DRAFT", "CALCULATED", "PENDING_APPROVAL", "APPROVED"].includes(run.status)) throw new Error("INVALID_TRANSITION");
  await prisma.approvalRequest.updateMany({ where: { docType: "PAYROLL", docId: id, status: "PENDING" }, data: { status: "CANCELLED" } });
  return prisma.payrollRun.update({ where: { id }, data: { status: "CANCELLED", updatedById: session.userId } });
}
export async function reopenRun(session: AppSession, id: string) {
  const run = await prisma.payrollRun.findFirst({ where: { id, companyId: session.companyId } });
  if (!run || !["CALCULATED", "APPROVED"].includes(run.status)) throw new Error("INVALID_TRANSITION");
  return prisma.payrollRun.update({ where: { id }, data: { status: "DRAFT", updatedById: session.userId } });
}
/** WPS salary file (generic CSV following the SAMA/WPS field set; adapt the column order to your bank's template). */
export async function generateWps(session: AppSession, id: string) {
  const run = await getRun(session, id);
  if (!run || !["APPROVED", "POSTED", "PAID"].includes(run.status)) throw new Error("INVALID_TRANSITION");
  const [company, s] = await Promise.all([prisma.company.findUniqueOrThrow({ where: { id: session.companyId } }), getHrSettings(session.companyId)]);
  const emps = await prisma.employee.findMany({ where: { id: { in: run.payslips.map((p) => p.employeeId) } }, select: { id: true, nationalId: true, iban: true, bankName: true } });
  const slips = run.payslips.filter((p) => p.paymentMethod !== "CASH");
  const period = `${run.periodYear}${String(run.periodMonth).padStart(2, "0")}`;
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const header = ["EmployerID", "EmployerName", "PaymentPeriod", "PayDate", "EmployeeID", "EmployeeName", "NationalID_Iqama", "BankName", "IBAN", "BasicSalary", "HousingAllowance", "OtherEarnings", "Deductions", "NetSalary", "PaymentDescription"];
  const rows = slips.map((p) => { const e = emps.find((x) => x.id === p.employeeId); const housing = p.lines.filter((l) => l.code === "HOUSING").reduce((a, l) => a + Number(l.amount), 0); const other = Number(p.totalEarnings) - Number(p.basic) - housing; return [s.wpsEstablishmentId ?? company.crNumber ?? "", company.nameEn, period, run.payDate.toISOString().slice(0, 10), p.employeeCode, p.employeeEn, e?.nationalId ?? "", e?.bankName ?? "", e?.iban ?? "", Number(p.basic).toFixed(2), housing.toFixed(2), other.toFixed(2), Number(p.totalDeductions).toFixed(2), Number(p.net).toFixed(2), `Salary ${period}`].map(esc).join(","); });
  const content = [header.join(","), ...rows].join("\r\n");
  const total = slips.reduce((a, p) => a.plus(p.net), D(0));
  const fileName = `WPS_${run.number}_${period}.csv`;
  return prisma.wpsFile.upsert({ where: { runId: id }, create: { runId: id, companyId: session.companyId, fileName, content, records: slips.length, totalAmount: total, generatedById: session.userId }, update: { fileName, content, records: slips.length, totalAmount: total, generatedAt: new Date(), generatedById: session.userId } });
}
export async function getWps(session: AppSession, runId: string) { return prisma.wpsFile.findFirst({ where: { runId, companyId: session.companyId } }); }
export async function getPayslip(session: AppSession, id: string) {
  const p = await prisma.payslip.findFirst({ where: { id, companyId: session.companyId }, include: { lines: { orderBy: { sortOrder: "asc" } }, run: true } });
  if (!p) return null;
  const allowed = await allowedEmployeeIds(session);
  if (allowed && !allowed.includes(p.employeeId)) return null;
  const e = await prisma.employee.findUniqueOrThrow({ where: { id: p.employeeId } });
  return { ...p, employee: e };
}
/** Self-service: my payslips (posted/paid runs). */
export async function myPayslips(session: AppSession, employeeId: string) {
  return prisma.payslip.findMany({ where: { companyId: session.companyId, employeeId, run: { status: { in: ["POSTED", "PAID"] } } }, orderBy: { run: { payDate: "desc" } }, take: 24, include: { run: { select: { number: true, periodYear: true, periodMonth: true, payDate: true, status: true } } } });
}
export function runColumns(tf: (k: string) => string, t: (k: string) => string): ColumnDef[] {
  return [
    { key: "number", label: tf("number"), sortable: true, type: "link", hrefTemplate: "/hr/payroll/{id}" }, { key: "period", label: tf("period") },
    { key: "payDate", label: t("payDate"), type: "date", sortable: true }, { key: "employeesCount", label: t("employeeCount"), type: "number", align: "center" },
    { key: "totalEarnings", label: t("earnings"), type: "money", align: "end" }, { key: "totalDeductions", label: t("deductions"), type: "money", align: "end" },
    { key: "totalGosiEmployer", label: t("gosiEmployer"), type: "money", align: "end", hidden: true }, { key: "totalNet", label: t("net"), type: "money", align: "end", sortable: true },
    { key: "status", label: tf("status"), type: "enum", enumName: "PayrollStatus", tones: { DRAFT: "secondary", CALCULATED: "info", PENDING_APPROVAL: "warning", APPROVED: "info", POSTED: "success", PAID: "success", CANCELLED: "destructive" } },
  ];
}
export function payslipColumns(tf: (k: string) => string, t: (k: string) => string): ColumnDef[] {
  return [
    { key: "number", label: tf("number"), type: "link", hrefTemplate: "/hr/payroll/payslip/{id}" }, { key: "employeeCode", label: tf("code") }, { key: "employee", label: t("employee"), bilingual: "employee" }, { key: "department", label: tf("department"), hidden: true },
    { key: "basic", label: t("basic"), type: "money", align: "end" }, { key: "totalEarnings", label: t("earnings"), type: "money", align: "end" }, { key: "gosiEmployee", label: t("gosiEmployee"), type: "money", align: "end" }, { key: "gosiEmployer", label: t("gosiEmployer"), type: "money", align: "end", hidden: true },
    { key: "loanDeduction", label: t("loanDeduction"), type: "money", align: "end" }, { key: "absenceDeduction", label: t("absenceDeduction"), type: "money", align: "end" }, { key: "overtimePay", label: t("overtimePay"), type: "money", align: "end", hidden: true },
    { key: "totalDeductions", label: t("deductions"), type: "money", align: "end" }, { key: "net", label: t("net"), type: "money", align: "end" }, { key: "paymentMethod", label: t("paymentMethod"), type: "enum", enumName: "PaymentMethod", hidden: true },
  ];
}
registerApprovalHooks("PAYROLL", {
  onApproved: async (tx, req) => { await tx.payrollRun.update({ where: { id: req.docId }, data: { status: "APPROVED" } }); },
  onRejected: async (tx, req) => { await tx.payrollRun.update({ where: { id: req.docId }, data: { status: "CALCULATED" } }); },
});
DOC_LINKS.PAYROLL = (id) => `/hr/payroll/${id}`;
export type { Tx };
