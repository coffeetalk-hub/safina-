/**
 * When each background job runs. Hours are Riyadh time (UTC+3, no daylight saving).
 * Pure so it can be unit-tested; the runner owns the database and locking.
 */
export type JobSchedule =
  | { job: string; every: "minutes"; minutes: number }
  | { job: string; every: "day"; hour: number }
  | { job: string; every: "month"; hour: number };

export const SCHEDULE: JobSchedule[] = [
  { job: "email", every: "minutes", minutes: 5 },
  { job: "recurring-journals", every: "day", hour: 2 },
  { job: "document-alerts", every: "day", hour: 6 },
  { job: "expiry-alerts", every: "day", hour: 6 },
  { job: "maintenance", every: "day", hour: 3 },
  { job: "depreciation", every: "month", hour: 2 },
];

const RIYADH_OFFSET_MS = 3 * 60 * 60 * 1000;
const riyadh = (d: Date) => new Date(d.getTime() + RIYADH_OFFSET_MS);
const dayKey = (d: Date) => riyadh(d).toISOString().slice(0, 10);
const monthKey = (d: Date) => riyadh(d).toISOString().slice(0, 7);

/** A missed run (restart, deploy) is caught up on the next check rather than skipped. */
export function isDue(schedule: JobSchedule, lastRunAt: Date | null, now: Date): boolean {
  if (schedule.every === "minutes") return !lastRunAt || now.getTime() - lastRunAt.getTime() >= schedule.minutes * 60_000;
  if (riyadh(now).getUTCHours() < schedule.hour) return false;
  if (!lastRunAt) return true;
  return schedule.every === "day" ? dayKey(lastRunAt) !== dayKey(now) : monthKey(lastRunAt) !== monthKey(now);
}
