/** Leave requests, balances and approval hooks. */
import { z } from "zod";
import { prisma, type Tx } from "@/lib/prisma";
import type { AppSession } from "@/core/auth/session";
import { orderByFrom, skipTake, type ColumnDef, type ListParams, type PagedResult } from "@/components/data-table/types";
import { nextDocumentNumber } from "@/core/numbering";
import { submitForApproval } from "@/core/approvals/engine";
import { registerApprovalHooks, DOC_LINKS } from "@/modules/foundation/approvals/hooks";
import { notify } from "@/core/notifications";
import { annualLeaveDays, calendarDays, serviceYears } from "./rules";
import { getHrSettings } from "./settings";
import { allowedEmployeeIds, scopeEmployee, withEmployee } from "./employees";

export const leaveSchema = z.object({ id: z.string().nullable().optional(), employeeId: z.string().nullable().optional(), leaveTypeId: z.string().min(1), startDate: z.string().min(10), endDate: z.string().min(10), days: z.coerce.number().positive().optional(), reason: z.string().max(1000).nullable().optional() });

async function where(session: AppSession, p: ListParams) {
  const w: Record<string, unknown> = { companyId: session.companyId };
  const allowed = await allowedEmployeeIds(session, "leave");
  if (allowed) w.employeeId = { in: allowed };
  if (p.filters.employeeId && !allowed) w.employeeId = p.filters.employeeId;
  if (p.filters.status) w.status = p.filters.status;
  if (p.filters.leaveTypeId) w.leaveTypeId = p.filters.leaveTypeId;
  if (p.filters.from || p.filters.to) w.startDate = { gte: p.filters.from ? new Date(p.filters.from) : undefined, lte: p.filters.to ? new Date(p.filters.to) : undefined };
  if (p.q) w.OR = [{ number: { contains: p.q, mode: "insensitive" } }, { reason: { contains: p.q, mode: "insensitive" } }];
  return w;
}
const include = { leaveType: { select: { code: true, nameAr: true, nameEn: true, isPaid: true } } };
export async function listLeave(session: AppSession, p: ListParams): Promise<PagedResult<Record<string, unknown>>> {
  const w = await where(session, p);
  const [rows, total] = await Promise.all([prisma.leaveRequest.findMany({ where: w, orderBy: orderByFrom(p.sort, ["number", "startDate", "endDate", "days", "status"], { startDate: "desc" }), ...skipTake(p), include }), prisma.leaveRequest.count({ where: w })]);
  return { rows: await withEmployee(session.companyId, rows), total, page: p.page, pageSize: p.pageSize };
}
export async function allLeave(session: AppSession, p: ListParams) { return withEmployee(session.companyId, await prisma.leaveRequest.findMany({ where: await where(session, p), orderBy: { startDate: "desc" }, take: 10_000, include })); }

/** Ensure the yearly balance rows exist for an employee (entitlement from service years / leave type). */
export async function ensureBalances(companyId: string, employeeId: string, year: number) {
  const [emp, types, s] = await Promise.all([prisma.employee.findUnique({ where: { id: employeeId }, select: { hireDate: true } }), prisma.leaveType.findMany({ where: { companyId, isActive: true, entitlementDays: { gt: 0 } } }), getHrSettings(companyId)]);
  if (!emp) return [];
  const yearStart = new Date(Date.UTC(year, 0, 1)); const yearEnd = new Date(Date.UTC(year, 11, 31));
  const years = emp.hireDate ? serviceYears(emp.hireDate, yearEnd) : 0;
  for (const t of types) {
    let entitled = t.code === "ANNUAL" ? annualLeaveDays(years, s.annualLeaveDays, s.annualLeaveDaysAfter5y) : t.entitlementDays;
    if (emp.hireDate && emp.hireDate > yearStart && t.code === "ANNUAL") entitled = Math.round((entitled * (12 - emp.hireDate.getUTCMonth())) / 12 * 100) / 100; // pro-rata hire year
    await prisma.leaveBalance.upsert({ where: { employeeId_leaveTypeId_year: { employeeId, leaveTypeId: t.id, year } }, create: { companyId, employeeId, leaveTypeId: t.id, year, entitled }, update: { entitled } });
  }
  return prisma.leaveBalance.findMany({ where: { employeeId, year }, include: { leaveType: true } });
}
export async function balancesFor(companyId: string, employeeId: string, year = new Date().getUTCFullYear()) {
  const rows = await ensureBalances(companyId, employeeId, year);
  return rows.map((b) => ({ ...b, remaining: Number(b.entitled) + Number(b.carried) + Number(b.adjusted) - Number(b.taken) }));
}
export async function adjustBalance(session: AppSession, input: { employeeId: string; leaveTypeId: string; year: number; adjusted: number; carried: number }) {
  await ensureBalances(session.companyId, input.employeeId, input.year);
  return prisma.leaveBalance.update({ where: { employeeId_leaveTypeId_year: { employeeId: input.employeeId, leaveTypeId: input.leaveTypeId, year: input.year } }, data: { adjusted: input.adjusted, carried: input.carried } });
}

export async function saveLeave(session: AppSession, input: z.infer<typeof leaveSchema>) {
  const employeeId = await scopeEmployee(session, "leave", input.employeeId);
  const type = await prisma.leaveType.findFirst({ where: { id: input.leaveTypeId, companyId: session.companyId } });
  if (!type) throw new Error("NOT_FOUND");
  const start = new Date(input.startDate), end = new Date(input.endDate);
  if (end < start) throw new Error("END_BEFORE_START");
  const days = input.days ?? calendarDays(start, end);
  if (type.maxDaysPerRequest && days > type.maxDaysPerRequest) throw new Error("LEAVE_EXCEEDS_MAX");
  const overlap = await prisma.leaveRequest.count({ where: { employeeId, status: { in: ["PENDING_APPROVAL", "APPROVED"] }, startDate: { lte: end }, endDate: { gte: start }, NOT: input.id ? { id: input.id } : undefined } });
  if (overlap) throw new Error("LEAVE_OVERLAP");
  if (type.deductsBalance) {
    const bal = (await balancesFor(session.companyId, employeeId, start.getUTCFullYear())).find((b) => b.leaveTypeId === type.id);
    if (bal && bal.remaining < days && type.code !== "SICK") throw new Error("LEAVE_INSUFFICIENT_BALANCE");
  }
  const data = { employeeId, leaveTypeId: type.id, startDate: start, endDate: end, days, reason: input.reason ?? null, updatedById: session.userId };
  return prisma.$transaction(async (tx) => {
    if (input.id) {
      const ex = await tx.leaveRequest.findFirst({ where: { id: input.id, companyId: session.companyId } });
      if (!ex || !["DRAFT", "REJECTED"].includes(ex.status)) throw new Error("NOT_DRAFT");
      await scopeEmployee(session, "leave", ex.employeeId);
      return tx.leaveRequest.update({ where: { id: input.id }, data: { ...data, status: "DRAFT" } });
    }
    const number = await nextDocumentNumber(tx, session.companyId, "LEAVE", start);
    return tx.leaveRequest.create({ data: { ...data, companyId: session.companyId, number, createdById: session.userId } });
  });
}
async function applyApproved(tx: Tx, id: string) {
  const r = await tx.leaveRequest.findUnique({ where: { id }, include: { leaveType: true } });
  if (!r) return;
  if (r.leaveType.deductsBalance) {
    const year = r.startDate.getUTCFullYear();
    await ensureBalances(r.companyId, r.employeeId, year);
    await tx.leaveBalance.update({ where: { employeeId_leaveTypeId_year: { employeeId: r.employeeId, leaveTypeId: r.leaveTypeId, year } }, data: { taken: { increment: r.days } } });
  }
  for (let d = new Date(r.startDate); d <= r.endDate; d.setUTCDate(d.getUTCDate() + 1)) {
    await tx.attendanceRecord.upsert({ where: { employeeId_day: { employeeId: r.employeeId, day: new Date(d) } }, create: { companyId: r.companyId, employeeId: r.employeeId, day: new Date(d), status: "LEAVE", notes: r.number }, update: { status: "LEAVE", checkIn: null, checkOut: null, punchInAt: null, punchOutAt: null, workedHrs: 0, lateMin: 0, earlyMin: 0, overtimeHrs: 0, notes: r.number } });
  }
  const emp = await tx.employee.findUnique({ where: { id: r.employeeId }, select: { userId: true } });
  if (emp?.userId) await notify(tx, { companyId: r.companyId, userId: emp.userId, type: "LEAVE_APPROVED", titleAr: `تمت الموافقة على إجازتك ${r.number}`, titleEn: `Your leave ${r.number} was approved`, link: "/hr/self", entityType: "LeaveRequest", entityId: r.id });
}
async function revertApproved(tx: Tx, id: string) {
  const r = await tx.leaveRequest.findUnique({ where: { id }, include: { leaveType: true } });
  if (!r) return;
  if (r.leaveType.deductsBalance) await tx.leaveBalance.updateMany({ where: { employeeId: r.employeeId, leaveTypeId: r.leaveTypeId, year: r.startDate.getUTCFullYear() }, data: { taken: { decrement: r.days } } });
  await tx.attendanceRecord.deleteMany({ where: { employeeId: r.employeeId, status: "LEAVE", notes: r.number } });
}
/** Submit: approval policy LEAVE, else approve immediately (types with requiresApproval=false also auto-approve). */
export async function submitLeave(session: AppSession, id: string) {
  return prisma.$transaction(async (tx) => {
    const r = await tx.leaveRequest.findFirst({ where: { id, companyId: session.companyId }, include: { leaveType: true } });
    if (!r) throw new Error("NOT_FOUND");
    await scopeEmployee(session, "leave", r.employeeId);
    if (!["DRAFT", "REJECTED"].includes(r.status)) throw new Error("NOT_DRAFT");
    const req = r.leaveType.requiresApproval ? await submitForApproval(tx, { companyId: session.companyId, docType: "LEAVE", docId: r.id, docNumber: r.number, amount: r.days, requestedById: session.userId, link: `/hr/leave` }) : null;
    if (req) { await tx.leaveRequest.update({ where: { id }, data: { status: "PENDING_APPROVAL", updatedById: session.userId } }); return { status: "PENDING_APPROVAL" }; }
    await tx.leaveRequest.update({ where: { id }, data: { status: "APPROVED", decidedAt: new Date(), decidedById: session.userId, updatedById: session.userId } });
    await applyApproved(tx, id);
    return { status: "APPROVED" };
  });
}
/** HR direct decision (hr.leave:approve) outside the policy inbox. */
export async function decideLeave(session: AppSession, id: string, decision: "APPROVED" | "REJECTED") {
  return prisma.$transaction(async (tx) => {
    const r = await tx.leaveRequest.findFirst({ where: { id, companyId: session.companyId } });
    if (!r || !["DRAFT", "PENDING_APPROVAL"].includes(r.status)) throw new Error("INVALID_TRANSITION");
    await tx.approvalRequest.updateMany({ where: { docType: "LEAVE", docId: id, status: "PENDING" }, data: { status: "CANCELLED" } });
    await tx.leaveRequest.update({ where: { id }, data: { status: decision, decidedAt: new Date(), decidedById: session.userId, updatedById: session.userId } });
    if (decision === "APPROVED") await applyApproved(tx, id);
    return { status: decision };
  });
}
export async function cancelLeave(session: AppSession, id: string) {
  return prisma.$transaction(async (tx) => {
    const r = await tx.leaveRequest.findFirst({ where: { id, companyId: session.companyId } });
    if (!r || r.status === "CANCELLED") throw new Error("INVALID_TRANSITION");
    await scopeEmployee(session, "leave", r.employeeId);
    if (r.status === "APPROVED") { if (r.startDate <= new Date() && !session.permissions.has("hr.leave:approve") && !session.permissions.has("*")) throw new Error("INVALID_TRANSITION"); await revertApproved(tx, id); }
    await tx.approvalRequest.updateMany({ where: { docType: "LEAVE", docId: id, status: "PENDING" }, data: { status: "CANCELLED" } });
    return tx.leaveRequest.update({ where: { id }, data: { status: "CANCELLED", updatedById: session.userId } });
  });
}
export function leaveColumns(tf: (k: string) => string, t: (k: string) => string): ColumnDef[] {
  return [
    { key: "number", label: tf("number"), sortable: true }, { key: "employee", label: t("employee"), bilingual: "employee" },
    { key: "leaveType", label: t("leaveType"), bilingual: "leaveType.name" },
    { key: "startDate", label: tf("startDate"), type: "date", sortable: true }, { key: "endDate", label: tf("endDate"), type: "date", sortable: true },
    { key: "days", label: t("days"), type: "number", align: "end", sortable: true }, { key: "reason", label: t("reason"), hidden: true },
    { key: "status", label: tf("status"), type: "enum", enumName: "LeaveStatus", tones: { DRAFT: "secondary", PENDING_APPROVAL: "warning", APPROVED: "success", REJECTED: "destructive", CANCELLED: "destructive" } },
  ];
}
registerApprovalHooks("LEAVE", {
  onApproved: async (tx, req) => { await tx.leaveRequest.update({ where: { id: req.docId }, data: { status: "APPROVED", decidedAt: new Date() } }); await applyApproved(tx, req.docId); },
  onRejected: async (tx, req) => { await tx.leaveRequest.update({ where: { id: req.docId }, data: { status: "REJECTED", decidedAt: new Date() } }); },
});
DOC_LINKS.LEAVE = () => `/hr/leave`;
