import { z } from "zod";
import { prisma } from "@/lib/prisma";
import type { AppSession } from "@/core/auth/session";
import { orderByFrom, skipTake, type ColumnDef, type ListParams, type PagedResult } from "@/components/data-table/types";
import { attendanceMetrics, isWeekend } from "./rules";
import { getHrSettings } from "./settings";
import { allowedEmployeeIds, withEmployee } from "./employees";

export const attendanceSchema = z.object({ id: z.string().nullable().optional(), employeeId: z.string().min(1), day: z.string().min(10), status: z.enum(["PRESENT", "ABSENT", "LEAVE", "REMOTE", "HOLIDAY", "WEEKEND"]).default("PRESENT"), checkIn: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional().or(z.literal("")), checkOut: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional().or(z.literal("")), overtimeHrs: z.coerce.number().min(0).max(16).default(0), notes: z.string().max(500).nullable().optional() });

async function where(session: AppSession, p: ListParams) {
  const w: Record<string, unknown> = { companyId: session.companyId };
  const allowed = await allowedEmployeeIds(session, "attendance");
  if (allowed) w.employeeId = { in: allowed };
  if (p.filters.employeeId) w.employeeId = allowed ? { in: allowed.filter((x) => x === p.filters.employeeId) } : p.filters.employeeId;
  if (p.filters.status) w.status = p.filters.status;
  const month = p.filters.month; // yyyy-mm
  if (month) { const [y, m] = month.split("-").map(Number); w.day = { gte: new Date(Date.UTC(y, m - 1, 1)), lte: new Date(Date.UTC(y, m, 0)) }; }
  else if (p.filters.from || p.filters.to) w.day = { gte: p.filters.from ? new Date(p.filters.from) : undefined, lte: p.filters.to ? new Date(p.filters.to) : undefined };
  return w;
}
export async function listAttendance(session: AppSession, p: ListParams): Promise<PagedResult<Record<string, unknown>>> {
  const w = await where(session, p);
  const [rows, total] = await Promise.all([prisma.attendanceRecord.findMany({ where: w, orderBy: orderByFrom(p.sort, ["day", "status", "lateMin", "overtimeHrs"], { day: "desc" }), ...skipTake(p) }), prisma.attendanceRecord.count({ where: w })]);
  return { rows: await withEmployee(session.companyId, rows), total, page: p.page, pageSize: p.pageSize };
}
export async function allAttendance(session: AppSession, p: ListParams) { return withEmployee(session.companyId, await prisma.attendanceRecord.findMany({ where: await where(session, p), orderBy: { day: "desc" }, take: 20_000 })); }

export async function saveAttendance(session: AppSession, input: z.infer<typeof attendanceSchema>) {
  const inCompany = await prisma.employee.count({ where: { id: input.employeeId, companyId: session.companyId } });
  if (!inCompany) throw new Error("NOT_FOUND");
  const s = await getHrSettings(session.companyId);
  const ci = input.checkIn || null, co = input.checkOut || null;
  const m = attendanceMetrics(ci, co, s.workStart, s.workEnd, s.graceMinutes, Number(s.dailyHours));
  const data = { status: input.status, checkIn: ci, checkOut: co, workedHrs: m.workedHrs, lateMin: m.lateMin, earlyMin: m.earlyMin, overtimeHrs: input.overtimeHrs || m.overtimeHrs, notes: input.notes ?? null, updatedById: session.userId };
  return prisma.attendanceRecord.upsert({ where: { employeeId_day: { employeeId: input.employeeId, day: new Date(input.day) } }, create: { ...data, companyId: session.companyId, employeeId: input.employeeId, day: new Date(input.day), createdById: session.userId }, update: data });
}
export async function removeAttendance(session: AppSession, id: string) {
  const r = await prisma.attendanceRecord.findFirst({ where: { id, companyId: session.companyId } });
  if (!r) throw new Error("NOT_FOUND");
  return prisma.attendanceRecord.delete({ where: { id } });
}
/** Fill a month for all active employees: weekends/holidays marked, approved leave → LEAVE, other days PRESENT (existing rows untouched). */
export async function generateMonth(session: AppSession, year: number, month: number) {
  const s = await getHrSettings(session.companyId);
  const from = new Date(Date.UTC(year, month - 1, 1)); const to = new Date(Date.UTC(year, month, 0));
  const [emps, holidays, leaves, existing] = await Promise.all([
    prisma.employee.findMany({ where: { companyId: session.companyId, status: { in: ["ACTIVE", "ON_LEAVE"] }, OR: [{ hireDate: null }, { hireDate: { lte: to } }] }, select: { id: true, hireDate: true, terminationDate: true } }),
    prisma.publicHoliday.findMany({ where: { companyId: session.companyId, date: { gte: from, lte: to } } }),
    prisma.leaveRequest.findMany({ where: { companyId: session.companyId, status: "APPROVED", startDate: { lte: to }, endDate: { gte: from } } }),
    prisma.attendanceRecord.findMany({ where: { companyId: session.companyId, day: { gte: from, lte: to } }, select: { employeeId: true, day: true } }),
  ]);
  const have = new Set(existing.map((x) => `${x.employeeId}|${x.day.toISOString().slice(0, 10)}`));
  const hol = new Set(holidays.map((h) => h.date.toISOString().slice(0, 10)));
  const rows: { companyId: string; employeeId: string; day: Date; status: "PRESENT" | "LEAVE" | "HOLIDAY" | "WEEKEND"; checkIn: string | null; checkOut: string | null; workedHrs: number; createdById: string }[] = [];
  for (const e of emps) {
    for (let d = new Date(from); d <= to; d.setUTCDate(d.getUTCDate() + 1)) {
      const iso = d.toISOString().slice(0, 10);
      if (have.has(`${e.id}|${iso}`)) continue;
      if (e.hireDate && d < e.hireDate) continue;
      if (e.terminationDate && d > e.terminationDate) continue;
      let status: "PRESENT" | "LEAVE" | "HOLIDAY" | "WEEKEND" = "PRESENT";
      if (isWeekend(d, s.weekendDays)) status = "WEEKEND";
      else if (hol.has(iso)) status = "HOLIDAY";
      else if (leaves.some((l) => l.employeeId === e.id && l.startDate <= d && l.endDate >= d)) status = "LEAVE";
      const working = status === "PRESENT";
      rows.push({ companyId: session.companyId, employeeId: e.id, day: new Date(d), status, checkIn: working ? s.workStart : null, checkOut: working ? s.workEnd : null, workedHrs: working ? Number(s.dailyHours) : 0, createdById: session.userId });
    }
  }
  if (rows.length) await prisma.attendanceRecord.createMany({ data: rows, skipDuplicates: true });
  return { created: rows.length, employees: emps.length };
}
/** Per-employee month summary (used by payroll). */
export async function monthSummary(companyId: string, year: number, month: number) {
  const from = new Date(Date.UTC(year, month - 1, 1)); const to = new Date(Date.UTC(year, month, 0));
  const rows = await prisma.attendanceRecord.groupBy({ by: ["employeeId", "status"], where: { companyId, day: { gte: from, lte: to } }, _count: { _all: true }, _sum: { overtimeHrs: true, lateMin: true } });
  const m = new Map<string, { present: number; absent: number; leave: number; remote: number; overtimeHrs: number; lateMin: number }>();
  for (const r of rows) {
    const e = m.get(r.employeeId) ?? { present: 0, absent: 0, leave: 0, remote: 0, overtimeHrs: 0, lateMin: 0 };
    if (r.status === "PRESENT") e.present += r._count._all; if (r.status === "ABSENT") e.absent += r._count._all; if (r.status === "LEAVE") e.leave += r._count._all; if (r.status === "REMOTE") e.remote += r._count._all;
    e.overtimeHrs += Number(r._sum.overtimeHrs ?? 0); e.lateMin += r._sum.lateMin ?? 0;
    m.set(r.employeeId, e);
  }
  return m;
}
export function attendanceColumns(tf: (k: string) => string, t: (k: string) => string): ColumnDef[] {
  return [
    { key: "day", label: tf("date"), type: "date", sortable: true }, { key: "employee", label: t("employee"), bilingual: "employee" },
    { key: "status", label: tf("status"), type: "enum", enumName: "AttendanceStatus", tones: { PRESENT: "success", ABSENT: "destructive", LEAVE: "info", REMOTE: "secondary", HOLIDAY: "outline", WEEKEND: "outline" } },
    { key: "checkIn", label: t("checkIn") }, { key: "checkOut", label: t("checkOut") },
    { key: "workedHrs", label: t("workedHrs"), type: "number", align: "end" }, { key: "lateMin", label: t("lateMin"), type: "number", align: "end", sortable: true },
    { key: "overtimeHrs", label: t("overtimeHrs"), type: "number", align: "end", sortable: true }, { key: "notes", label: tf("notes"), hidden: true },
  ];
}
