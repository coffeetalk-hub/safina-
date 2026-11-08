/**
 * Pure Saudi labour-law / GOSI calculations. No database access, so these run on the
 * server, in unit tests and (if needed) in the browser. All rule PARAMETERS come from
 * HrSettings / GosiRate rows — nothing here hard-codes a percentage that the law may change.
 */
export type GosiRates = { employeePension: number; employerPension: number; employeeSaned: number; employerSaned: number; employerHazard: number };

export const r2 = (n: number) => Math.round(n * 100) / 100;

/** GOSI contributions. Wage is clamped to [min, max] (Saudis) or [0, max] (non-Saudis, hazard only). */
export function computeGosi(isSaudi: boolean, wageBase: number, rates: GosiRates, minWage: number, maxWage: number) {
  let wage = Math.min(wageBase, maxWage);
  if (isSaudi) wage = Math.max(wage, minWage);
  if (wageBase <= 0) wage = 0;
  const employeePct = rates.employeePension + rates.employeeSaned;
  const employerPct = rates.employerPension + rates.employerSaned + rates.employerHazard;
  return { wage: r2(wage), employee: r2((wage * employeePct) / 100), employer: r2((wage * employerPct) / 100), employeePct, employerPct };
}

/** Years of service as a decimal (365.25-day years). */
export function serviceYears(hireDate: Date, endDate: Date) {
  return Math.max(0, (endDate.getTime() - hireDate.getTime()) / (365.25 * 86_400_000));
}

export type EosReasonCode = "RESIGNATION" | "TERMINATION" | "END_OF_CONTRACT" | "ARTICLE_80" | "RETIREMENT" | "DEATH" | "MUTUAL";

/**
 * End-of-service benefit (Labour Law Art. 84 & 85):
 *  - half a month's wage for each of the first five years, a full month's wage for each following year, pro-rata for fractions;
 *  - resignation: nothing under 2 years, one third for 2–5 years, two thirds for 5–10 years, full after 10 years;
 *  - Art. 80 termination (gross misconduct): nothing. Employer termination, contract end, retirement, death, mutual: full.
 */
export function computeEosb(years: number, monthlyWage: number, reason: EosReasonCode) {
  const first = Math.min(years, 5) * 0.5 * monthlyWage;
  const rest = Math.max(years - 5, 0) * 1 * monthlyWage;
  const full = first + rest;
  let fraction = 1;
  if (reason === "ARTICLE_80") fraction = 0;
  else if (reason === "RESIGNATION") fraction = years < 2 ? 0 : years < 5 ? 1 / 3 : years < 10 ? 2 / 3 : 1;
  return { fullEntitlement: r2(full), fraction, pct: Math.round(fraction * 100), amount: r2(full * fraction) };
}

/** Annual leave entitlement (Art. 109): 21 days, 30 days once service reaches five years. */
export function annualLeaveDays(years: number, base: number, after5: number) {
  return years >= 5 ? after5 : base;
}

/**
 * Sick-leave pay fraction for the N-th cumulative sick day in a service year (Art. 117):
 * first `full` days 100 %, next `partial` days at `partialPct`, next `unpaid` days 0 %. Beyond that: 0.
 */
export function sickPayFraction(dayIndex: number, full: number, partial: number, partialPct: number) {
  if (dayIndex < full) return 1;
  if (dayIndex < full + partial) return partialPct / 100;
  return 0;
}

/** Daily wage = monthly wage / days-per-month divisor (30 by convention); hourly = basic / (days × hours). */
export function dailyWage(monthly: number, daysPerMonth: number) { return monthly / daysPerMonth; }
export function hourlyRate(basic: number, daysPerMonth: number, dailyHours: number) { return basic / (daysPerMonth * dailyHours); }
/** Overtime (Art. 107): hourly wage + 50 % → multiplier 1.5 by default. */
export function overtimePay(hours: number, basic: number, daysPerMonth: number, dailyHours: number, multiplier: number) {
  return r2(hours * hourlyRate(basic, daysPerMonth, dailyHours) * multiplier);
}

/** Inclusive calendar days between two ISO dates. */
export function calendarDays(start: Date, end: Date) {
  return Math.floor((Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()) - Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate())) / 86_400_000) + 1;
}

export const WEEKDAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"] as const;
export function isWeekend(d: Date, weekendDays: string) {
  return weekendDays.split(",").map((x) => x.trim().toUpperCase()).includes(WEEKDAYS[d.getUTCDay()]);
}
/** Minutes between two HH:mm strings (negative if b < a). */
export function minutesBetween(a: string, b: string) {
  const [ah, am] = a.split(":").map(Number); const [bh, bm] = b.split(":").map(Number);
  return bh * 60 + bm - (ah * 60 + am);
}
/** Derive late / early / worked / overtime from check-in & out against the schedule. */
export function attendanceMetrics(checkIn: string | null, checkOut: string | null, workStart: string, workEnd: string, graceMinutes: number, dailyHours: number) {
  if (!checkIn || !checkOut) return { lateMin: 0, earlyMin: 0, workedHrs: 0, overtimeHrs: 0 };
  const late = Math.max(0, minutesBetween(workStart, checkIn));
  const early = Math.max(0, minutesBetween(checkOut, workEnd));
  // The schedule span minus daily hours is the (unpaid) break, e.g. 08:00–17:00 with 8 h → 1 h break.
  const breakHrs = Math.max(0, minutesBetween(workStart, workEnd) / 60 - dailyHours);
  const raw = Math.max(0, minutesBetween(checkIn, checkOut)) / 60;
  const worked = Math.max(0, raw - (raw > breakHrs ? breakHrs : 0));
  return { lateMin: late > graceMinutes ? late : 0, earlyMin: early > graceMinutes ? early : 0, workedHrs: r2(worked), overtimeHrs: r2(Math.max(0, worked - dailyHours)) };
}

const RIYADH_OFFSET_MS = 3 * 60 * 60 * 1000;

/** Wall-clock date and time in Riyadh (UTC+3, no daylight saving). `day` is midnight UTC of that date, as attendance stores it. */
export function riyadhClock(now: Date) {
  const iso = new Date(now.getTime() + RIYADH_OFFSET_MS).toISOString();
  return { day: new Date(`${iso.slice(0, 10)}T00:00:00.000Z`), time: iso.slice(11, 16) };
}

/** Attendance figures for a completed punch. Uses real elapsed time when the shift crosses midnight. */
export function punchMetrics(input: { checkIn: string; checkOut: string; elapsedMinutes: number; workStart: string; workEnd: string; graceMinutes: number; dailyHours: number; nonWorkingDay: boolean }) {
  const { checkIn, checkOut, elapsedMinutes, workStart, workEnd, graceMinutes, dailyHours, nonWorkingDay } = input;
  const metrics = attendanceMetrics(checkIn, checkOut, workStart, workEnd, graceMinutes, dailyHours);
  const overnight = minutesBetween(checkIn, checkOut) < 0;
  let { workedHrs } = metrics;
  if (overnight) {
    const breakHrs = Math.max(0, minutesBetween(workStart, workEnd) / 60 - dailyHours);
    const raw = elapsedMinutes / 60;
    workedHrs = r2(Math.max(0, raw - (raw > breakHrs ? breakHrs : 0)));
  }
  return { lateMin: nonWorkingDay ? 0 : metrics.lateMin, earlyMin: nonWorkingDay || overnight ? 0 : metrics.earlyMin, workedHrs, overtimeHrs: r2(Math.max(0, workedHrs - dailyHours)) };
}
