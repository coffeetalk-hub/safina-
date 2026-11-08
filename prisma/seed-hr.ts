/** HR & payroll demo data for the first company: defaults, contracts, documents, salary structures, holidays, attendance, leave, loan, payroll runs (previous month posted & paid, current month calculated), draft EOSB. */
import { prisma } from "../src/lib/prisma";
import type { AppSession } from "../src/core/auth/session";
import { ensureHrDefaults } from "../src/modules/hr/settings";
import { contracts, documents, saveSalaryStructure } from "../src/modules/hr/employees";
import { generateMonth, saveAttendance } from "../src/modules/hr/attendance";
import { saveLeave, submitLeave, decideLeave, ensureBalances } from "../src/modules/hr/leave";
import { saveLoan, submitLoan, disburseLoan } from "../src/modules/hr/loans";
import { createRun, calculateRun, submitRun, postRun, payRun, generateWps } from "../src/modules/hr/payroll";
import { saveEosb } from "../src/modules/hr/eosb";

const iso = (d: Date) => d.toISOString().slice(0, 10);
const days = (n: number) => { const d = new Date(); d.setUTCDate(d.getUTCDate() + n); return d; };

export async function seedHr(companyId: string, userId: string) {
  if ((await prisma.payrollRun.count({ where: { companyId } })) > 0) { console.log("  HR demo data already present — skipping"); return; }
  const s = { userId, companyId, email: "seed", nameAr: "seed", nameEn: "seed", locale: "en", isSuperAdmin: true, companyIds: [companyId], branchId: null, permissions: new Set(["*"]) } as AppSession;
  await ensureHrDefaults(companyId);
  const emps = await prisma.employee.findMany({ where: { companyId }, orderBy: { code: "asc" } });
  const comps = await prisma.payComponent.findMany({ where: { companyId } });
  const c = (code: string) => comps.find((x) => x.code === code)!.id;
  const types = await prisma.leaveType.findMany({ where: { companyId } });
  const lt = (code: string) => types.find((x) => x.code === code)!.id;
  const now = new Date(); const y = now.getUTCFullYear(), m = now.getUTCMonth() + 1;
  const prev = new Date(Date.UTC(y, m - 2, 1)); const py = prev.getUTCFullYear(), pm = prev.getUTCMonth() + 1;

  // Contracts + salary structures + documents
  const basics = [25000, 15000, 12000, 11000, 9000, 8000, 10000, 7000, 6500, 9500, 8500, 6000, 5500, 7500, 4500];
  for (const [i, e] of emps.entries()) {
    await contracts.save(s, { employeeId: e.id, type: e.isSaudi ? "UNLIMITED" : "LIMITED", startDate: iso(e.hireDate ?? days(-365)), endDate: e.isSaudi ? null : iso(days(i === 6 ? 40 : 300 + i * 10)), probationEndDate: null, workingHoursWeek: 48, noticeDays: 60, jobTitleAr: e.jobTitleAr, jobTitleEn: e.jobTitleEn, status: "ACTIVE", notes: null, number: null });
    await saveSalaryStructure(s, { employeeId: e.id, basic: basics[i] ?? 5000, currencyCode: "SAR", paymentMethod: i === 14 ? "CASH" : "BANK_TRANSFER", effectiveFrom: iso(e.hireDate ?? days(-365)), notes: null, lines: [{ componentId: c("HOUSING"), value: 25 }, { componentId: c("TRANSPORT"), value: 10 }, { componentId: c("PHONE"), value: i < 5 ? 300 : 150 }, ...(i % 4 === 0 ? [{ componentId: c("MED_INS"), value: 150 }] : [])] });
    if (!e.isSaudi) {
      await documents.save(s, { employeeId: e.id, type: "IQAMA", number: `2${String(400000000 + i * 7919)}`, issueDate: iso(days(-700)), expiryDate: iso(days(i === 5 ? 18 : i === 6 ? -5 : 200 + i * 15)), alertDays: 60, notes: null });
      await documents.save(s, { employeeId: e.id, type: "PASSPORT", number: `P${String(1000000 + i * 311)}`, issueDate: iso(days(-1500)), expiryDate: iso(days(900 + i * 30)), alertDays: 90, notes: null });
      await documents.save(s, { employeeId: e.id, type: "WORK_PERMIT", number: null, issueDate: iso(days(-300)), expiryDate: iso(days(65)), alertDays: 30, notes: null });
    } else {
      await documents.save(s, { employeeId: e.id, type: "NATIONAL_ID", number: e.nationalId ?? `10${String(10000000 + i)}`, issueDate: null, expiryDate: iso(days(1000 + i * 40)), alertDays: 30, notes: null });
    }
    await documents.save(s, { employeeId: e.id, type: "MEDICAL_INSURANCE", number: `TKF-${2026}-${String(i + 1).padStart(3, "0")}`, issueDate: iso(days(-200)), expiryDate: iso(days(165)), alertDays: 30, notes: "Takaful class B" });
    await ensureBalances(companyId, e.id, y);
  }
  // Public holidays
  for (const h of [{ date: `${y}-02-22`, nameAr: "يوم التأسيس", nameEn: "Founding Day" }, { date: `${y}-09-23`, nameAr: "اليوم الوطني", nameEn: "National Day" }]) await prisma.publicHoliday.upsert({ where: { companyId_date: { companyId, date: new Date(h.date) } }, create: { companyId, ...h, date: new Date(h.date) }, update: {} });

  // Leave: approved annual last month (emp 3), approved sick this month (emp 7), pending (emp 9), draft (emp 15 = self-service user)
  const l1 = await saveLeave(s, { employeeId: emps[2].id, leaveTypeId: lt("ANNUAL"), startDate: iso(new Date(Date.UTC(py, pm - 1, 10))), endDate: iso(new Date(Date.UTC(py, pm - 1, 16))), reason: "Family trip" });
  await decideLeave(s, l1.id, "APPROVED");
  const l2 = await saveLeave(s, { employeeId: emps[6].id, leaveTypeId: lt("SICK"), startDate: iso(new Date(Date.UTC(y, m - 1, 3))), endDate: iso(new Date(Date.UTC(y, m - 1, 5))), reason: "Medical report attached" });
  await decideLeave(s, l2.id, "APPROVED");
  const l3 = await saveLeave(s, { employeeId: emps[8].id, leaveTypeId: lt("ANNUAL"), startDate: iso(days(20)), endDate: iso(days(27)), reason: "Vacation" });
  await submitLeave(s, l3.id); // LEAVE policy in seed → pending approval
  await saveLeave(s, { employeeId: emps[14].id, leaveTypeId: lt("ANNUAL"), startDate: iso(days(40)), endDate: iso(days(43)), reason: "Personal" });

  // Loan for emp 10: approved + disbursed, deductions from last month
  const loan = await saveLoan(s, { employeeId: emps[9].id, loanDate: iso(new Date(Date.UTC(py, pm - 1, 2))), amount: 6000, installments: 6, firstMonth: `${py}-${String(pm).padStart(2, "0")}`, reason: "Housing advance" });
  await submitLoan(s, loan.id);
  await prisma.employeeLoan.update({ where: { id: loan.id }, data: { status: "APPROVED" } });
  await prisma.approvalRequest.updateMany({ where: { docType: "LOAN", docId: loan.id, status: "PENDING" }, data: { status: "APPROVED" } });
  await disburseLoan(s, loan.id);

  // Attendance: previous + current month, with absences and overtime
  await generateMonth(s, py, pm);
  await generateMonth(s, y, m);
  await saveAttendance(s, { employeeId: emps[12].id, day: iso(new Date(Date.UTC(py, pm - 1, 8))), status: "ABSENT", checkIn: "", checkOut: "", overtimeHrs: 0, notes: "No show" });
  await saveAttendance(s, { employeeId: emps[12].id, day: iso(new Date(Date.UTC(py, pm - 1, 9))), status: "ABSENT", checkIn: "", checkOut: "", overtimeHrs: 0, notes: null });
  await saveAttendance(s, { employeeId: emps[10].id, day: iso(new Date(Date.UTC(py, pm - 1, 15))), status: "PRESENT", checkIn: "08:00", checkOut: "20:00", overtimeHrs: 0, notes: "Release night" });
  await saveAttendance(s, { employeeId: emps[10].id, day: iso(new Date(Date.UTC(py, pm - 1, 16))), status: "PRESENT", checkIn: "08:40", checkOut: "17:00", overtimeHrs: 0, notes: null });

  // Payroll: previous month → calculated → approved → posted → paid + WPS; current month calculated
  const r1 = await createRun(s, { periodYear: py, periodMonth: pm, payDate: iso(new Date(Date.UTC(py, pm - 1, 27))), branchId: null, notes: "Demo payroll" });
  await calculateRun(s, r1.id);
  await submitRun(s, r1.id);
  await postRun(s, r1.id);
  await payRun(s, r1.id);
  await generateWps(s, r1.id);
  const r2 = await createRun(s, { periodYear: y, periodMonth: m, payDate: iso(new Date(Date.UTC(y, m - 1, 27))), branchId: null, notes: null });
  await calculateRun(s, r2.id);

  // Draft EOSB for emp 13 (resignation after ~3 years) — not posted so the employee stays active
  await saveEosb(s, { employeeId: emps[12].id, terminationDate: iso(days(30)), reason: "RESIGNATION", leaveDays: null, otherAdditions: 0, otherDeductions: 0, notes: "Draft — pending HR review" });
  console.log("  HR demo data created (payroll %s-%s posted & paid, %s-%s calculated)", py, pm, y, m);
}
