import { prisma } from "@/lib/prisma";
import type { AppSession } from "@/core/auth/session";

/** Headcount by department with Saudization (Nitaqat-style %) — active employees only. */
export async function headcount(session: AppSession) {
  const emps = await prisma.employee.findMany({ where: { companyId: session.companyId, status: { in: ["ACTIVE", "ON_LEAVE"] } }, select: { department: true, isSaudi: true, gender: true, hireDate: true } });
  const m = new Map<string, { department: string; total: number; saudi: number; nonSaudi: number; male: number; female: number }>();
  for (const e of emps) { const k = e.department ?? "—"; const r = m.get(k) ?? { department: k, total: 0, saudi: 0, nonSaudi: 0, male: 0, female: 0 }; r.total++; if (e.isSaudi) r.saudi++; else r.nonSaudi++; if (e.gender === "FEMALE") r.female++; else r.male++; m.set(k, r); }
  const rows = [...m.values()].map((r) => ({ ...r, saudizationPct: r.total ? Math.round((r.saudi / r.total) * 1000) / 10 : 0 })).sort((a, b) => b.total - a.total);
  const total = emps.length, saudi = emps.filter((e) => e.isSaudi).length;
  return { rows, total, saudi, saudizationPct: total ? Math.round((saudi / total) * 1000) / 10 : 0 };
}
/** Payroll cost per month (posted/paid runs). */
export async function payrollByMonth(session: AppSession, year: number) {
  const runs = await prisma.payrollRun.findMany({ where: { companyId: session.companyId, periodYear: year, status: { in: ["POSTED", "PAID", "APPROVED", "CALCULATED"] } }, orderBy: { periodMonth: "asc" } });
  return runs.map((r) => ({ period: `${r.periodYear}-${String(r.periodMonth).padStart(2, "0")}`, number: r.number, employees: r.employeesCount, earnings: Number(r.totalEarnings), deductions: Number(r.totalDeductions), gosiEmployee: Number(r.totalGosiEmployee), gosiEmployer: Number(r.totalGosiEmployer), net: Number(r.totalNet), cost: Number(r.totalEarnings) + Number(r.totalGosiEmployer), status: r.status }));
}
/** Payroll cost by cost center (posted/paid payslips in a year). */
export async function payrollByCostCenter(session: AppSession, year: number) {
  const slips = await prisma.payslip.findMany({ where: { companyId: session.companyId, run: { periodYear: year, status: { in: ["POSTED", "PAID"] } } }, select: { costCenterId: true, totalEarnings: true, gosiEmployer: true, net: true, absenceDeduction: true } });
  const ccs = await prisma.costCenter.findMany({ where: { companyId: session.companyId }, select: { id: true, code: true, nameAr: true, nameEn: true } });
  const m = new Map<string, { code: string; nameAr: string; nameEn: string; payslips: number; earnings: number; gosiEmployer: number; net: number }>();
  for (const s of slips) { const cc = ccs.find((c) => c.id === s.costCenterId); const k = s.costCenterId ?? "-"; const r = m.get(k) ?? { code: cc?.code ?? "-", nameAr: cc?.nameAr ?? "غير محدد", nameEn: cc?.nameEn ?? "Unassigned", payslips: 0, earnings: 0, gosiEmployer: 0, net: 0 }; r.payslips++; r.earnings += Number(s.totalEarnings) - Number(s.absenceDeduction); r.gosiEmployer += Number(s.gosiEmployer); r.net += Number(s.net); m.set(k, r); }
  return [...m.values()].map((r) => ({ ...r, cost: r.earnings + r.gosiEmployer })).sort((a, b) => b.cost - a.cost);
}
/** GOSI contributions summary per run (for the monthly GOSI payment). */
export async function gosiSummary(session: AppSession, year: number) {
  const slips = await prisma.payslip.findMany({ where: { companyId: session.companyId, run: { periodYear: year, status: { in: ["APPROVED", "POSTED", "PAID"] } } }, select: { gosiWage: true, gosiEmployee: true, gosiEmployer: true, employeeId: true, run: { select: { periodMonth: true } } } });
  const emps = await prisma.employee.findMany({ where: { id: { in: [...new Set(slips.map((s) => s.employeeId))] } }, select: { id: true, isSaudi: true } });
  const m = new Map<string, { period: string; saudi: number; nonSaudi: number; wage: number; employee: number; employer: number; total: number }>();
  for (const s of slips) { const k = `${year}-${String(s.run.periodMonth).padStart(2, "0")}`; const r = m.get(k) ?? { period: k, saudi: 0, nonSaudi: 0, wage: 0, employee: 0, employer: 0, total: 0 }; if (emps.find((e) => e.id === s.employeeId)?.isSaudi) r.saudi++; else r.nonSaudi++; r.wage += Number(s.gosiWage); r.employee += Number(s.gosiEmployee); r.employer += Number(s.gosiEmployer); r.total = r.employee + r.employer; m.set(k, r); }
  return [...m.values()].sort((a, b) => a.period.localeCompare(b.period));
}
/** Leave summary per employee for a year. */
export async function leaveSummary(session: AppSession, year: number) {
  const bals = await prisma.leaveBalance.findMany({ where: { companyId: session.companyId, year }, include: { leaveType: { select: { code: true } } } });
  const emps = await prisma.employee.findMany({ where: { companyId: session.companyId, status: { in: ["ACTIVE", "ON_LEAVE"] } }, select: { id: true, code: true, firstNameAr: true, lastNameAr: true, firstNameEn: true, lastNameEn: true, department: true } });
  const unpaid = await prisma.leaveRequest.groupBy({ by: ["employeeId"], where: { companyId: session.companyId, status: "APPROVED", leaveType: { isPaid: false }, startDate: { gte: new Date(Date.UTC(year, 0, 1)), lte: new Date(Date.UTC(year, 11, 31)) } }, _sum: { days: true } });
  return emps.map((e) => { const a = bals.find((b) => b.employeeId === e.id && b.leaveType.code === "ANNUAL"); const s = bals.find((b) => b.employeeId === e.id && b.leaveType.code === "SICK"); return { code: e.code, nameAr: `${e.firstNameAr} ${e.lastNameAr}`, nameEn: `${e.firstNameEn} ${e.lastNameEn}`, department: e.department ?? "", annualEntitled: Number(a?.entitled ?? 0) + Number(a?.carried ?? 0) + Number(a?.adjusted ?? 0), annualTaken: Number(a?.taken ?? 0), annualRemaining: Number(a?.entitled ?? 0) + Number(a?.carried ?? 0) + Number(a?.adjusted ?? 0) - Number(a?.taken ?? 0), sickTaken: Number(s?.taken ?? 0), unpaidDays: Number(unpaid.find((u) => u.employeeId === e.id)?._sum.days ?? 0) }; });
}
/** Expiring documents & contracts in the next 90 days. */
export async function expiringItems(session: AppSession) {
  const to = new Date(Date.now() + 90 * 86_400_000);
  const [docs, contracts] = await Promise.all([
    prisma.employeeDocument.findMany({ where: { companyId: session.companyId, expiryDate: { lte: to } }, orderBy: { expiryDate: "asc" } }),
    prisma.employeeContract.findMany({ where: { companyId: session.companyId, status: "ACTIVE", endDate: { lte: to } }, orderBy: { endDate: "asc" } }),
  ]);
  const ids = [...new Set([...docs.map((d) => d.employeeId), ...contracts.map((c) => c.employeeId)])];
  const emps = await prisma.employee.findMany({ where: { id: { in: ids } }, select: { id: true, code: true, firstNameAr: true, lastNameAr: true, firstNameEn: true, lastNameEn: true } });
  const nm = (id: string) => { const e = emps.find((x) => x.id === id); return { employeeId: id, code: e?.code ?? "", nameAr: e ? `${e.firstNameAr} ${e.lastNameAr}` : "", nameEn: e ? `${e.firstNameEn} ${e.lastNameEn}` : "" }; };
  const rows = [
    ...docs.map((d) => ({ kind: "DOCUMENT", type: d.type, number: d.number ?? "", date: d.expiryDate as Date, ...nm(d.employeeId) })),
    ...contracts.map((c) => ({ kind: "CONTRACT", type: c.type, number: c.number, date: c.endDate as Date, ...nm(c.employeeId) })),
  ];
  return rows.map((r) => ({ ...r, daysLeft: Math.ceil((r.date.getTime() - Date.now()) / 86_400_000) })).sort((a, b) => a.daysLeft - b.daysLeft);
}
