import { describe, expect, it } from "vitest";
import { punchMetrics, riyadhClock } from "@/modules/hr/rules";

const schedule = { workStart: "08:00", workEnd: "17:00", graceMinutes: 10, dailyHours: 8 };

describe("riyadhClock", () => {
  it("uses Riyadh's date and time, not the server's", () => {
    const { day, time } = riyadhClock(new Date("2026-11-07T22:30:00Z"));
    expect(day.toISOString()).toBe("2026-11-08T00:00:00.000Z");
    expect(time).toBe("01:30");
  });
});

describe("punchMetrics", () => {
  const base = { ...schedule, nonWorkingDay: false };

  it("treats a full on-time day as eight worked hours after the break", () => {
    expect(punchMetrics({ ...base, checkIn: "08:00", checkOut: "17:00", elapsedMinutes: 540 })).toEqual({ lateMin: 0, earlyMin: 0, workedHrs: 8, overtimeHrs: 0 });
  });

  it("flags lateness and leaving early beyond the grace period", () => {
    const m = punchMetrics({ ...base, checkIn: "08:30", checkOut: "16:30", elapsedMinutes: 480 });
    expect(m.lateMin).toBe(30);
    expect(m.earlyMin).toBe(30);
    expect(m.workedHrs).toBe(7);
  });

  it("counts an overnight shift from the real elapsed time", () => {
    const m = punchMetrics({ ...base, checkIn: "22:00", checkOut: "06:00", elapsedMinutes: 480 });
    expect(m.workedHrs).toBe(7);
    expect(m.earlyMin).toBe(0);
  });

  it("does not mark anyone late on a weekend or holiday", () => {
    const m = punchMetrics({ ...schedule, nonWorkingDay: true, checkIn: "11:00", checkOut: "12:00", elapsedMinutes: 60 });
    expect(m.lateMin).toBe(0);
    expect(m.earlyMin).toBe(0);
  });
});
