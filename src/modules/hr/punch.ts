/** Punch in / punch out for the signed-in user. The server clock is the only source of time. */
import { prisma } from "@/lib/prisma";
import type { AppSession } from "@/core/auth/session";
import { attendanceMetrics, isWeekend, minutesBetween, punchMetrics, riyadhClock } from "./rules";
import { getHrSettings } from "./settings";
import { myEmployee } from "./employees";

export type PunchPhase = "NOT_LINKED" | "OFF" | "IN" | "OUT" | "ON_LEAVE";

export type PunchState = {
  phase: PunchPhase;
  serverNow: string;
  punchInAt: string | null;
  checkIn: string | null;
  checkOut: string | null;
  lateMin: number;
  workedHrs: number;
  /** Length of the working day in minutes, breaks included: a full ring on the dial. */
  shiftMinutes: number;
  /** First punch-in to last punch-out, for a finished day. */
  spanMinutes: number;
  workEnd: string;
  /** A recent day the user punched in and never punched out, as yyyy-mm-dd. */
  forgottenDay: string | null;
};

/** A punch-in older than this is treated as a forgotten punch-out, not a shift still running. */
const MAX_SHIFT_MS = 16 * 60 * 60 * 1000;
const FORGOTTEN_LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000;

async function currentEmployee(session: AppSession) {
  const me = await myEmployee(session);
  return me && ["ACTIVE", "ON_LEAVE"].includes(me.status) ? me : null;
}

async function loadPunch(employeeId: string, now: Date) {
  const { day } = riyadhClock(now);
  const [today, unfinished] = await Promise.all([
    prisma.attendanceRecord.findUnique({ where: { employeeId_day: { employeeId, day } } }),
    prisma.attendanceRecord.findMany({ where: { employeeId, checkOut: null, punchInAt: { gte: new Date(now.getTime() - FORGOTTEN_LOOKBACK_MS) } }, orderBy: { punchInAt: "desc" }, take: 2 }),
  ]);
  const running = unfinished.find((r) => r.punchInAt && now.getTime() - r.punchInAt.getTime() < MAX_SHIFT_MS) ?? null;
  const forgotten = unfinished.find((r) => r !== running) ?? null;
  return { today, running, forgotten };
}

function toState(loaded: Awaited<ReturnType<typeof loadPunch>>, settings: { workStart: string; workEnd: string }, now: Date): PunchState {
  const { today, running, forgotten } = loaded;
  const record = running ?? today;
  const phase: PunchPhase = running ? "IN" : today?.status === "LEAVE" ? "ON_LEAVE" : today?.punchInAt ? "OUT" : "OFF";
  const punched = phase === "IN" || phase === "OUT";
  return {
    phase,
    serverNow: now.toISOString(),
    punchInAt: punched ? (record?.punchInAt?.toISOString() ?? null) : null,
    checkIn: punched ? (record?.checkIn ?? null) : null,
    checkOut: phase === "OUT" ? (record?.checkOut ?? null) : null,
    lateMin: punched ? (record?.lateMin ?? 0) : 0,
    workedHrs: phase === "OUT" ? Number(record?.workedHrs ?? 0) : 0,
    shiftMinutes: Math.max(1, minutesBetween(settings.workStart, settings.workEnd)),
    spanMinutes: phase === "OUT" && record?.punchInAt && record.punchOutAt ? Math.floor((record.punchOutAt.getTime() - record.punchInAt.getTime()) / 60_000) : 0,
    workEnd: settings.workEnd,
    forgottenDay: forgotten ? forgotten.day.toISOString().slice(0, 10) : null,
  };
}

const notLinked = (now: Date): PunchState => ({ phase: "NOT_LINKED", serverNow: now.toISOString(), punchInAt: null, checkIn: null, checkOut: null, lateMin: 0, workedHrs: 0, shiftMinutes: 1, spanMinutes: 0, workEnd: "", forgottenDay: null });

/** What the punch control shows for the signed-in user in the active company. */
export async function punchState(session: AppSession): Promise<PunchState> {
  const now = new Date();
  const me = await currentEmployee(session);
  if (!me) return notLinked(now);
  const [loaded, settings] = await Promise.all([loadPunch(me.id, now), getHrSettings(session.companyId)]);
  return toState(loaded, settings, now);
}

async function isNonWorkingDay(companyId: string, day: Date, weekendDays: string) {
  if (isWeekend(day, weekendDays)) return true;
  return (await prisma.publicHoliday.count({ where: { companyId, date: day } })) > 0;
}

/** Records a punch. Repeating the current state (double click, second tab) changes nothing. */
export async function punch(session: AppSession, action: "IN" | "OUT"): Promise<PunchState> {
  const me = await currentEmployee(session);
  if (!me) throw new Error("NO_EMPLOYEE_RECORD");
  const now = new Date();
  const settings = await getHrSettings(session.companyId);
  const daily = Number(settings.dailyHours);
  const { day, time } = riyadhClock(now);
  const loaded = await loadPunch(me.id, now);
  const { today, running } = loaded;

  if (action === "IN" && !running) {
    if (today?.status === "LEAVE") throw new Error("PUNCH_ON_LEAVE");
    if (today?.punchInAt) {
      // Back from a break: the day stays first punch-in to last punch-out.
      await prisma.attendanceRecord.update({ where: { id: today.id }, data: { checkOut: null, punchOutAt: null, workedHrs: 0, earlyMin: 0, overtimeHrs: 0, updatedById: session.userId } });
    } else {
      const nonWorking = await isNonWorkingDay(session.companyId, day, settings.weekendDays);
      const { lateMin } = attendanceMetrics(time, time, settings.workStart, settings.workEnd, settings.graceMinutes, daily);
      const data = { status: today?.status === "REMOTE" ? ("REMOTE" as const) : ("PRESENT" as const), checkIn: time, checkOut: null, punchInAt: now, punchOutAt: null, workedHrs: 0, lateMin: nonWorking ? 0 : lateMin, earlyMin: 0, overtimeHrs: 0, updatedById: session.userId };
      await prisma.attendanceRecord.upsert({ where: { employeeId_day: { employeeId: me.id, day } }, create: { ...data, companyId: session.companyId, employeeId: me.id, day, createdById: session.userId }, update: data });
    }
  }

  if (action === "OUT" && running?.punchInAt && running.checkIn) {
    const nonWorking = await isNonWorkingDay(session.companyId, running.day, settings.weekendDays);
    const metrics = punchMetrics({ checkIn: running.checkIn, checkOut: time, elapsedMinutes: Math.floor((now.getTime() - running.punchInAt.getTime()) / 60_000), workStart: settings.workStart, workEnd: settings.workEnd, graceMinutes: settings.graceMinutes, dailyHours: daily, nonWorkingDay: nonWorking });
    await prisma.attendanceRecord.update({ where: { id: running.id }, data: { checkOut: time, punchOutAt: now, ...metrics, updatedById: session.userId } });
  }

  return toState(await loadPunch(me.id, now), settings, now);
}
