import { describe, expect, it } from "vitest";
import { allPermissions, ROLE_TEMPLATES } from "@/core/rbac/permissions";
import { isDue, SCHEDULE, type JobSchedule } from "@/core/cron/schedule";
import { clientIp } from "@/core/auth/client-ip";

const perms = (role: string) => new Set<string>(ROLE_TEMPLATES[role].permissions());

describe("role templates", () => {
  it("only grant permissions that exist in the catalogue", () => {
    const catalogue = new Set<string>(allPermissions());
    for (const [role, tpl] of Object.entries(ROLE_TEMPLATES)) {
      for (const p of tpl.permissions()) expect(catalogue.has(p), `${role}: ${p}`).toBe(true);
    }
  });

  it("limit employees to their own records", () => {
    const employee = perms("EMPLOYEE");
    for (const p of employee) expect(p, p).toMatch(/^(hr\.self|purchasing\.myRequest|foundation\.dashboard):/);
    expect(employee.has("hr.self:view")).toBe(true);
    expect(employee.has("purchasing.myRequest:create")).toBe(true);
  });

  it("keep salaries and employee files away from non-HR roles", () => {
    const hrOnly = ["hr.payroll:view", "hr.employee:view", "hr.eosb:view", "hr.document:view", "foundation.employee:view"];
    for (const role of ["ACCOUNTANT", "FINANCE_MANAGER", "SALES", "PURCHASING", "EMPLOYEE", "APPROVER"]) {
      for (const p of hrOnly) expect(perms(role).has(p), `${role}: ${p}`).toBe(false);
    }
  });

  it("keep administration with administrators", () => {
    const admin = ["foundation.user:view", "foundation.role:view", "foundation.audit:view", "foundation.settings:view", "foundation.company:view"];
    for (const role of ["ACCOUNTANT", "FINANCE_MANAGER", "SALES", "PURCHASING", "HR", "EMPLOYEE", "APPROVER"]) {
      for (const p of admin) expect(perms(role).has(p), `${role}: ${p}`).toBe(false);
    }
  });

  it("keep departments out of each other's modules", () => {
    for (const p of perms("SALES")) expect(p, p).not.toMatch(/^(hr|purchasing)\./);
    for (const p of perms("PURCHASING")) expect(p, p).not.toMatch(/^(hr|sales)\./);
    for (const p of perms("HR")) expect(p, p).not.toMatch(/^(finance|sales|purchasing)\./);
  });
});

describe("job schedule", () => {
  const daily: JobSchedule = { job: "x", every: "day", hour: 2 };
  const monthly: JobSchedule = { job: "x", every: "month", hour: 2 };
  const interval: JobSchedule = { job: "x", every: "minutes", minutes: 5 };
  const at = (iso: string) => new Date(iso);

  it("runs interval jobs once the interval has passed", () => {
    expect(isDue(interval, null, at("2026-11-08T10:00:00Z"))).toBe(true);
    expect(isDue(interval, at("2026-11-08T09:56:00Z"), at("2026-11-08T10:00:00Z"))).toBe(false);
    expect(isDue(interval, at("2026-11-08T09:55:00Z"), at("2026-11-08T10:00:00Z"))).toBe(true);
  });

  it("runs daily jobs after the hour in Riyadh time, once per Riyadh day", () => {
    // 22:30 UTC on the 7th is 01:30 on the 8th in Riyadh: too early.
    expect(isDue(daily, at("2026-11-06T23:30:00Z"), at("2026-11-07T22:30:00Z"))).toBe(false);
    // 23:30 UTC on the 7th is 02:30 on the 8th in Riyadh: due.
    expect(isDue(daily, at("2026-11-06T23:30:00Z"), at("2026-11-07T23:30:00Z"))).toBe(true);
    expect(isDue(daily, at("2026-11-07T23:30:00Z"), at("2026-11-08T10:00:00Z"))).toBe(false);
  });

  it("catches up a monthly job that missed the 1st", () => {
    expect(isDue(monthly, at("2026-10-01T00:00:00Z"), at("2026-11-05T10:00:00Z"))).toBe(true);
    expect(isDue(monthly, at("2026-11-01T00:00:00Z"), at("2026-11-05T10:00:00Z"))).toBe(false);
  });

  it("schedules every job at most once", () => {
    expect(new Set(SCHEDULE.map((s) => s.job)).size).toBe(SCHEDULE.length);
  });
});

describe("client address", () => {
  it("prefers the edge's X-Real-IP over a client-supplied X-Forwarded-For", () => {
    expect(clientIp(new Headers({ "x-real-ip": "203.0.113.9", "x-forwarded-for": "1.1.1.1" }))).toBe("203.0.113.9");
    expect(clientIp(new Headers({ "x-forwarded-for": "198.51.100.1, 10.0.0.1" }))).toBe("198.51.100.1");
    expect(clientIp(new Headers())).toBeNull();
  });
});
