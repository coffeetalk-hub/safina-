import { getTranslations } from "next-intl/server";
import type { Exporter } from "@/core/export/registry";
import type { ColumnDef } from "@/components/data-table/types";
import { contracts, contractColumns, documents, documentColumns, withDaysLeft, withEmployee } from "./employees";
import { allAttendance, attendanceColumns } from "./attendance";
import { allLeave, leaveColumns } from "./leave";
import { allLoans, loanColumns } from "./loans";
import { allRuns, runColumns, getRun, payslipColumns } from "./payroll";
import { allEosb, eosColumns } from "./eosb";
import { gosiRates, gosiRateColumns, holidays, holidayColumns, payComponents, payComponentColumns, leaveTypes, leaveTypeColumns } from "./settings";
import { headcount, payrollByMonth, payrollByCostCenter, gosiSummary, leaveSummary, expiringItems } from "./reports";

const make = (permission: string, columns: (tf: (k: string) => string, t: (k: string) => string) => ColumnDef[], load: Exporter["load"], ar: string, en: string): Exporter => ({
  permission,
  columns: async (locale) => { const [tf, t] = await Promise.all([getTranslations({ locale, namespace: "fields" }), getTranslations({ locale, namespace: "hr" })]); return columns((k) => tf(k), (k) => t(k)); },
  load, sheetName: (locale) => (locale === "ar" ? ar : en),
});
const year = (p: Parameters<Exporter["load"]>[1]) => Number(p.filters.year) || new Date().getUTCFullYear();

export const contractsX = make("hr.contract:view", contractColumns, async (s, p) => withEmployee(s.companyId, await contracts.all(s, p)), "عقود الموظفين", "Employee contracts");
export const documentsX = make("hr.document:view", documentColumns, async (s, p) => withEmployee(s.companyId, withDaysLeft(await documents.all(s, p) as { employeeId: string; expiryDate: Date | null }[])), "وثائق الموظفين", "Employee documents");
export const attendanceX = make("hr.attendance:view", attendanceColumns, (s, p) => allAttendance(s, p), "الحضور", "Attendance");
export const leaveX = make("hr.leave:view", leaveColumns, (s, p) => allLeave(s, p), "طلبات الإجازة", "Leave requests");
export const loansX = make("hr.loan:view", loanColumns, (s, p) => allLoans(s, p), "السلف", "Employee loans");
export const runsX = make("hr.payroll:view", runColumns, (s, p) => allRuns(s, p), "مسيرات الرواتب", "Payroll runs");
export const payslipsX = make("hr.payroll:view", payslipColumns, async (s, p) => { const run = p.filters.runId ? await getRun(s, p.filters.runId) : null; return run ? run.payslips : []; }, "قسائم الرواتب", "Payslips");
export const eosX = make("hr.eosb:view", eosColumns, (s, p) => allEosb(s, p), "نهاية الخدمة", "End of service");
export const gosiRatesX = make("hr.payroll:view", gosiRateColumns, (s, p) => gosiRates.all(s, p), "نسب التأمينات", "GOSI rates");
export const holidaysX = make("hr.attendance:view", (tf) => holidayColumns(tf), (s, p) => holidays.all(s, p), "العطل الرسمية", "Public holidays");
export const payComponentsX = make("hr.payroll:view", payComponentColumns, (s, p) => payComponents.all(s, p), "عناصر الراتب", "Pay components");
export const leaveTypesX = make("hr.leave:view", leaveTypeColumns, (s, p) => leaveTypes.all(s, p), "أنواع الإجازات", "Leave types");
export const headcountX = make("hr.report:view", (tf, t) => [{ key: "department", label: tf("department") }, { key: "total", label: t("reports.headcount"), type: "number" }, { key: "saudi", label: t("reports.saudi"), type: "number" }, { key: "nonSaudi", label: t("reports.nonSaudi"), type: "number" }, { key: "saudizationPct", label: t("reports.saudization"), type: "number" }, { key: "male", label: t("reports.male"), type: "number" }, { key: "female", label: t("reports.female"), type: "number" }], async (s) => (await headcount(s)).rows, "القوى العاملة", "Headcount");
export const payrollMonthX = make("hr.report:view", (tf, t) => [{ key: "period", label: tf("period") }, { key: "number", label: tf("number") }, { key: "employees", label: t("employeeCount"), type: "number" }, { key: "earnings", label: t("earnings"), type: "money" }, { key: "deductions", label: t("deductions"), type: "money" }, { key: "gosiEmployer", label: t("gosiEmployer"), type: "money" }, { key: "net", label: t("net"), type: "money" }, { key: "cost", label: t("reports.employerCost"), type: "money" }], (s, p) => payrollByMonth(s, year(p)), "تكلفة الرواتب الشهرية", "Payroll by month");
export const payrollCcX = make("hr.report:view", (tf, t) => [{ key: "code", label: tf("code") }, { key: "name", label: tf("costCenter"), bilingual: "name" }, { key: "payslips", label: t("payslips"), type: "number" }, { key: "earnings", label: t("earnings"), type: "money" }, { key: "gosiEmployer", label: t("gosiEmployer"), type: "money" }, { key: "cost", label: t("reports.employerCost"), type: "money" }], (s, p) => payrollByCostCenter(s, year(p)), "الرواتب حسب مركز التكلفة", "Payroll by cost center");
export const gosiX = make("hr.report:view", (tf, t) => [{ key: "period", label: tf("period") }, { key: "saudi", label: t("reports.saudi"), type: "number" }, { key: "nonSaudi", label: t("reports.nonSaudi"), type: "number" }, { key: "wage", label: t("gosi.wage"), type: "money" }, { key: "employee", label: t("gosiEmployee"), type: "money" }, { key: "employer", label: t("gosiEmployer"), type: "money" }, { key: "total", label: t("reports.total"), type: "money" }], (s, p) => gosiSummary(s, year(p)), "ملخص التأمينات", "GOSI summary");
export const leaveSummaryX = make("hr.report:view", (tf, t) => [{ key: "code", label: tf("code") }, { key: "name", label: t("employee"), bilingual: "name" }, { key: "department", label: tf("department") }, { key: "annualEntitled", label: t("reports.annualEntitled"), type: "number" }, { key: "annualTaken", label: t("reports.annualTaken"), type: "number" }, { key: "annualRemaining", label: t("reports.annualRemaining"), type: "number" }, { key: "sickTaken", label: t("reports.sickTaken"), type: "number" }, { key: "unpaidDays", label: t("reports.unpaidDays"), type: "number" }], (s, p) => leaveSummary(s, year(p)), "ملخص الإجازات", "Leave summary");
export const expiringX = make("hr.report:view", (tf, t) => [{ key: "kind", label: tf("type") }, { key: "type", label: tf("category") }, { key: "number", label: tf("number") }, { key: "code", label: tf("code") }, { key: "name", label: t("employee"), bilingual: "name" }, { key: "date", label: t("expiryDate"), type: "date" }, { key: "daysLeft", label: t("daysLeft"), type: "number" }], (s) => expiringItems(s), "وثائق تنتهي قريبًا", "Expiring documents");
