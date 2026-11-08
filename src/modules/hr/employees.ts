/** Employee file: contracts, documents (with expiry alerts), salary structure, self-service lookup. */
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import type { AppSession } from "@/core/auth/session";
import { can } from "@/core/auth/session";
import { makeCrud, zOptStr } from "@/modules/foundation/_shared/crud";
import type { ColumnDef } from "@/components/data-table/types";
import { allocateNumber } from "@/core/numbering";
import { notify } from "@/core/notifications";
import { registerCronJob } from "@/core/cron";

export const empName = (e: { firstNameAr: string; lastNameAr: string; firstNameEn: string; lastNameEn: string; code?: string }) => ({ nameAr: `${e.firstNameAr} ${e.lastNameAr}`, nameEn: `${e.firstNameEn} ${e.lastNameEn}` });
const empSelect = { id: true, code: true, firstNameAr: true, lastNameAr: true, firstNameEn: true, lastNameEn: true, isSaudi: true, hireDate: true, terminationDate: true, status: true, costCenterId: true, branchId: true, department: true, jobTitleAr: true, jobTitleEn: true, bankName: true, iban: true, gosiNumber: true, nationalId: true, userId: true };

/** Attach employeeAr/employeeEn to rows that carry employeeId (lists). */
export async function withEmployee<T extends { employeeId: string }>(companyId: string, rows: T[]) {
  const ids = [...new Set(rows.map((r) => r.employeeId))];
  const emps = await prisma.employee.findMany({ where: { id: { in: ids } }, select: empSelect });
  return rows.map((r) => { const e = emps.find((x) => x.id === r.employeeId); return { ...r, employeeCode: e?.code ?? "", employeeAr: e ? empName(e).nameAr : "", employeeEn: e ? empName(e).nameEn : "" }; });
}
/** The employee record linked to the signed-in user (self-service). */
export async function myEmployee(session: AppSession) {
  return prisma.employee.findFirst({ where: { companyId: session.companyId, userId: session.userId }, select: empSelect });
}
/** Employees the user may act for: all (hr.employee:view) or only self. Returns null when unrestricted. */
export async function allowedEmployeeIds(session: AppSession): Promise<string[] | null> {
  if (can(session, "hr.employee:view")) return null;
  const me = await myEmployee(session);
  return me ? [me.id] : [];
}
export async function scopeEmployee(session: AppSession, employeeId: string | null | undefined) {
  const allowed = await allowedEmployeeIds(session);
  if (allowed === null) { if (!employeeId) throw new Error("EMPLOYEE_REQUIRED"); return employeeId; }
  if (allowed.length === 0) throw new Error("NO_EMPLOYEE_RECORD");
  if (employeeId && employeeId !== allowed[0]) throw new Error("FORBIDDEN");
  return allowed[0];
}

// ── Contracts ──
export const contractSchema = z.object({ id: z.string().nullable().optional(), employeeId: z.string().min(1), number: zOptStr(30), type: z.enum(["UNLIMITED", "LIMITED", "PART_TIME"]).default("UNLIMITED"), startDate: z.string().min(10), endDate: zOptStr(10), probationEndDate: zOptStr(10), workingHoursWeek: z.coerce.number().int().min(1).max(60).default(48), noticeDays: z.coerce.number().int().min(0).max(180).default(60), jobTitleAr: zOptStr(120), jobTitleEn: zOptStr(120), status: z.enum(["ACTIVE", "ENDED", "TERMINATED"]).default("ACTIVE"), notes: zOptStr(2000) });
export const contracts = makeCrud({
  model: "employeeContract", resource: "contract", schema: contractSchema, searchFields: ["number", "jobTitleAr", "jobTitleEn"], sortFields: ["number", "startDate", "endDate", "status"], defaultOrder: { startDate: "desc" },
  filterWhere: (f) => { const w: Record<string, unknown> = {}; if (f.employeeId) w.employeeId = f.employeeId; if (f.status) w.status = f.status; if (f.type) w.type = f.type; if (f.expiring === "true") w.endDate = { gte: new Date(), lte: new Date(Date.now() + 90 * 86_400_000) }; return w; },
  beforeSave: async (d, session, id) => {
    if (d.endDate && new Date(d.endDate) <= new Date(d.startDate)) throw new Error("END_BEFORE_START");
    if (d.type === "LIMITED" && !d.endDate) throw new Error("END_DATE_REQUIRED");
    const out = { ...d, startDate: new Date(d.startDate), endDate: d.endDate ? new Date(d.endDate) : null, probationEndDate: d.probationEndDate ? new Date(d.probationEndDate) : null } as unknown as typeof d & { number?: string | null };
    if (!id && !d.number) out.number = await allocateNumber(session.companyId, "EMP_CONTRACT", new Date(d.startDate));
    if (d.status === "ACTIVE") await prisma.employeeContract.updateMany({ where: { employeeId: d.employeeId, status: "ACTIVE", NOT: id ? { id } : undefined }, data: { status: "ENDED" } });
    return out;
  },
});
export function contractColumns(tf: (k: string) => string, t: (k: string) => string): ColumnDef[] {
  return [
    { key: "number", label: tf("number"), sortable: true }, { key: "employee", label: t("employee"), bilingual: "employee" },
    { key: "type", label: tf("type"), type: "enum", enumName: "ContractType" },
    { key: "startDate", label: tf("startDate"), type: "date", sortable: true }, { key: "endDate", label: tf("endDate"), type: "date", sortable: true },
    { key: "probationEndDate", label: t("probationEnd"), type: "date", hidden: true }, { key: "workingHoursWeek", label: t("hoursPerWeek"), type: "number", align: "end", hidden: true },
    { key: "jobTitle", label: t("jobTitle"), bilingual: "jobTitle" },
    { key: "status", label: tf("status"), type: "enum", enumName: "EmployeeContractStatus", tones: { ACTIVE: "success", ENDED: "secondary", TERMINATED: "destructive" } },
  ];
}

// ── Documents ──
import { HR_DOC_TYPES } from "./constants";
export { HR_DOC_TYPES };
export const documentSchema = z.object({ id: z.string().nullable().optional(), employeeId: z.string().min(1), type: z.enum(HR_DOC_TYPES).default("IQAMA"), number: zOptStr(60), issueDate: zOptStr(10), expiryDate: zOptStr(10), alertDays: z.coerce.number().int().min(0).max(365).default(30), notes: zOptStr(1000) });
export const documents = makeCrud({
  model: "employeeDocument", resource: "document", schema: documentSchema, searchFields: ["number", "notes"], sortFields: ["type", "expiryDate"], defaultOrder: { expiryDate: "asc" },
  filterWhere: (f) => { const w: Record<string, unknown> = {}; if (f.employeeId) w.employeeId = f.employeeId; if (f.type) w.type = f.type; if (f.expiring === "true") w.expiryDate = { lte: new Date(Date.now() + 60 * 86_400_000) }; return w; },
  beforeSave: async (d) => ({ ...d, issueDate: d.issueDate ? new Date(d.issueDate) : null, expiryDate: d.expiryDate ? new Date(d.expiryDate) : null }) as unknown as typeof d,
});
export function documentColumns(tf: (k: string) => string, t: (k: string) => string): ColumnDef[] {
  return [
    { key: "employee", label: t("employee"), bilingual: "employee" }, { key: "type", label: tf("type"), type: "enum", enumName: "HrDocumentType" },
    { key: "number", label: tf("number") }, { key: "issueDate", label: t("issueDate"), type: "date", hidden: true }, { key: "expiryDate", label: t("expiryDate"), type: "date", sortable: true },
    { key: "daysLeft", label: t("daysLeft"), type: "number", align: "end" }, { key: "alertDays", label: t("alertDays"), type: "number", align: "end", hidden: true },
  ];
}
export function withDaysLeft<T extends { expiryDate: Date | null }>(rows: T[]) {
  return rows.map((r) => ({ ...r, daysLeft: r.expiryDate ? Math.ceil((r.expiryDate.getTime() - Date.now()) / 86_400_000) : null }));
}
/** Cron `document-alerts`: notify HR users (hr.document:edit) and the employee's own user when a document enters its alert window (once a day). */
export async function documentExpiryAlerts() {
  const now = new Date();
  const docs = await prisma.employeeDocument.findMany({ where: { expiryDate: { not: null }, OR: [{ lastAlertAt: null }, { lastAlertAt: { lt: new Date(now.getTime() - 86_400_000) } }] } });
  let notified = 0;
  for (const d of docs) {
    const daysLeft = Math.ceil(((d.expiryDate as Date).getTime() - now.getTime()) / 86_400_000);
    if (daysLeft > d.alertDays) continue;
    const emp = await prisma.employee.findUnique({ where: { id: d.employeeId }, select: empSelect });
    if (!emp) continue;
    const hrUsers = await prisma.userCompanyRole.findMany({ where: { userCompany: { companyId: d.companyId }, role: { permissions: { some: { permission: "hr.document:edit" } } } }, select: { userCompany: { select: { userId: true } } } });
    const targets = new Set(hrUsers.map((x) => x.userCompany.userId)); if (emp.userId) targets.add(emp.userId);
    const n = empName(emp);
    for (const u of targets) {
      await notify(prisma, { companyId: d.companyId, userId: u, type: "DOCUMENT_EXPIRING", titleAr: `${d.type} ${d.number ?? ""} — ${n.nameAr} ${daysLeft < 0 ? "منتهية" : `تنتهي خلال ${daysLeft} يومًا`}`, titleEn: `${d.type} ${d.number ?? ""} — ${n.nameEn} ${daysLeft < 0 ? "expired" : `expires in ${daysLeft} days`}`, link: `/hr/employees/${emp.id}`, entityType: "EmployeeDocument", entityId: d.id, email: true });
      notified++;
    }
    await prisma.employeeDocument.update({ where: { id: d.id }, data: { lastAlertAt: now } });
  }
  return { checked: docs.length, notified };
}
registerCronJob("document-alerts", documentExpiryAlerts);

// ── Salary structure ──
export const salarySchema = z.object({ employeeId: z.string().min(1), basic: z.coerce.number().min(0), currencyCode: z.string().length(3).default("SAR"), paymentMethod: z.enum(["BANK_TRANSFER", "CASH"]).default("BANK_TRANSFER"), effectiveFrom: z.string().min(10), notes: zOptStr(1000), lines: z.array(z.object({ componentId: z.string(), value: z.coerce.number().min(0) })) });
export async function getSalaryStructure(companyId: string, employeeId: string) {
  return prisma.salaryStructure.findFirst({ where: { companyId, employeeId }, include: { lines: { include: { component: true } } } });
}
export async function saveSalaryStructure(session: AppSession, input: z.infer<typeof salarySchema>) {
  const emp = await prisma.employee.findFirst({ where: { id: input.employeeId, companyId: session.companyId } });
  if (!emp) throw new Error("NOT_FOUND");
  return prisma.$transaction(async (tx) => {
    const data = { basic: input.basic, currencyCode: input.currencyCode, paymentMethod: input.paymentMethod, effectiveFrom: new Date(input.effectiveFrom), notes: input.notes ?? null, updatedById: session.userId };
    const s = await tx.salaryStructure.upsert({ where: { employeeId: input.employeeId }, create: { ...data, companyId: session.companyId, employeeId: input.employeeId, createdById: session.userId }, update: data });
    await tx.salaryStructureLine.deleteMany({ where: { structureId: s.id } });
    if (input.lines.length) await tx.salaryStructureLine.createMany({ data: input.lines.filter((l) => l.value > 0).map((l) => ({ structureId: s.id, componentId: l.componentId, value: l.value })) });
    return s;
  });
}
/** Resolve a structure into concrete monthly amounts. */
export function resolveSalary(s: { basic: unknown; lines: { value: unknown; component: { id: string; code: string; nameAr: string; nameEn: string; type: string; calc: string; isHousing: boolean; accountId: string | null; sortOrder: number } }[] }) {
  const basic = Number(s.basic);
  const lines = s.lines.map((l) => ({ ...l.component, amount: l.component.calc === "PERCENT_OF_BASIC" ? Math.round(basic * Number(l.value)) / 100 : Number(l.value) })).sort((a, b) => a.sortOrder - b.sortOrder);
  const earnings = lines.filter((l) => l.type === "EARNING"); const deductions = lines.filter((l) => l.type === "DEDUCTION");
  const housing = earnings.filter((l) => l.isHousing).reduce((a, l) => a + l.amount, 0);
  const gross = basic + earnings.reduce((a, l) => a + l.amount, 0);
  return { basic, housing, gross, earnings, deductions, fixedDeductions: deductions.reduce((a, l) => a + l.amount, 0) };
}

/** Everything the employee file page needs. */
export async function employeeFile(session: AppSession, employeeId: string) {
  const emp = await prisma.employee.findFirst({ where: { id: employeeId, companyId: session.companyId }, include: { branch: { select: { nameAr: true, nameEn: true } }, costCenter: { select: { code: true, nameAr: true, nameEn: true } }, manager: { select: { firstNameAr: true, lastNameAr: true, firstNameEn: true, lastNameEn: true } } } });
  if (!emp) return null;
  const year = new Date().getUTCFullYear();
  const [contractRows, docRows, salary, balances, leaves, loans, payslips, eos, components] = await Promise.all([
    prisma.employeeContract.findMany({ where: { employeeId, companyId: session.companyId }, orderBy: { startDate: "desc" } }),
    prisma.employeeDocument.findMany({ where: { employeeId, companyId: session.companyId }, orderBy: { expiryDate: "asc" } }),
    getSalaryStructure(session.companyId, employeeId),
    prisma.leaveBalance.findMany({ where: { employeeId, year }, include: { leaveType: true } }),
    prisma.leaveRequest.findMany({ where: { employeeId, companyId: session.companyId }, orderBy: { startDate: "desc" }, take: 20, include: { leaveType: { select: { nameAr: true, nameEn: true, code: true } } } }),
    prisma.employeeLoan.findMany({ where: { employeeId, companyId: session.companyId }, orderBy: { loanDate: "desc" } }),
    prisma.payslip.findMany({ where: { employeeId, companyId: session.companyId }, orderBy: { run: { payDate: "desc" } }, take: 24, include: { run: { select: { id: true, number: true, periodYear: true, periodMonth: true, payDate: true, status: true } } } }),
    prisma.endOfServiceCalc.findMany({ where: { employeeId, companyId: session.companyId }, orderBy: { createdAt: "desc" } }),
    prisma.payComponent.findMany({ where: { companyId: session.companyId, isActive: true }, orderBy: { sortOrder: "asc" } }),
  ]);
  return { employee: emp, contracts: contractRows, documents: withDaysLeft(docRows), salary, resolved: salary ? resolveSalary(salary) : null, balances, leaves, loans, payslips, eos, components };
}
