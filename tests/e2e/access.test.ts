/**
 * Who can reach what, checked over HTTP against a running server with the demo seed loaded.
 * Run: E2E_BASE_URL=http://localhost:3000 npm run test:e2e
 */
import { beforeAll, describe, expect, it } from "vitest";

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const PASSWORD = "Safina@2026";

class Browser {
  private jar = new Map<string, string>();
  private store(res: Response) {
    for (const c of res.headers.getSetCookie()) {
      const [pair] = c.split(";");
      const i = pair.indexOf("=");
      const value = pair.slice(i + 1);
      if (value) this.jar.set(pair.slice(0, i), value);
      else this.jar.delete(pair.slice(0, i));
    }
  }
  private get cookie() {
    return [...this.jar].map(([k, v]) => `${k}=${v}`).join("; ");
  }
  async signIn(email: string, password = PASSWORD, provider = "credentials") {
    const csrf = await fetch(`${BASE}/api/auth/csrf`);
    this.store(csrf);
    const { csrfToken } = (await csrf.json()) as { csrfToken: string };
    const res = await fetch(`${BASE}/api/auth/callback/${provider}`, {
      method: "POST",
      redirect: "manual",
      headers: { "content-type": "application/x-www-form-urlencoded", cookie: this.cookie },
      body: new URLSearchParams({ csrfToken, email, password, callbackUrl: `${BASE}/en` }),
    });
    this.store(res);
    return this.cookie.includes("session-token");
  }
  async get(path: string) {
    const res = await fetch(BASE + path, { redirect: "manual", headers: { cookie: this.cookie } });
    return { status: res.status, body: await res.text() };
  }
  /** "forbidden" also covers pages that stream the 403 fallback after a 200 status line. */
  async access(path: string): Promise<"ok" | "forbidden" | number> {
    const { status, body } = await this.get(`/en${path}`);
    if (status === 403 || body.includes("NEXT_HTTP_ERROR_FALLBACK;403")) return "forbidden";
    return status === 200 ? "ok" : status;
  }
}

const session = async (role: string) => {
  const b = new Browser();
  expect(await b.signIn(`${role}@thesailors.ai`), `sign in as ${role}`).toBe(true);
  return b;
};
const distinct = (body: string, pattern: RegExp) => new Set(body.match(pattern) ?? []).size;

const HR_COMPANY_WIDE = ["/hr/employees", "/hr/attendance", "/hr/leave", "/hr/leave/balances", "/hr/leave/types", "/hr/payroll", "/hr/loans", "/hr/eosb", "/hr/documents", "/hr/contracts", "/hr/settings", "/hr/reports"];
const PURCHASING_STAFF = ["/purchasing/rfq", "/purchasing/orders", "/purchasing/contracts", "/purchasing/evaluations", "/purchasing/reports"];
const SALES_PAGES = ["/sales/leads", "/sales/pipeline", "/sales/quotations", "/sales/orders", "/sales/price-lists", "/sales/portal-users", "/sales/reports"];
const FINANCE_PAGES = ["/finance/journals", "/finance/ar/invoices", "/finance/ap/bills", "/finance/bank", "/finance/assets", "/finance/vat", "/finance/reports/trial-balance"];
const ADMIN_PAGES = ["/foundation/users", "/foundation/roles", "/foundation/audit", "/foundation/settings", "/foundation/companies"];

async function expectAccess(b: Browser, pages: string[], expected: "ok" | "forbidden") {
  for (const p of pages) expect(await b.access(p), p).toBe(expected);
}

describe("employee", () => {
  let b: Browser;
  beforeAll(async () => { b = await session("employee"); });

  it("reaches only their own area", async () => {
    await expectAccess(b, ["/dashboard", "/approvals", "/notifications", "/hr/self", "/hr/leave/new", "/purchasing/requests", "/purchasing/requests/new"], "ok");
  });

  it("cannot open company-wide HR, purchasing, sales, finance or admin screens", async () => {
    await expectAccess(b, [...HR_COMPANY_WIDE, ...PURCHASING_STAFF, ...SALES_PAGES, ...FINANCE_PAGES, ...ADMIN_PAGES, "/foundation/employees", "/foundation/vendors"], "forbidden");
  });

  it("cannot export colleagues' data", async () => {
    for (const r of ["hr-attendance", "hr-leave", "hr-loans", "hr-payroll-runs", "hr-payslips", "employees", "vendors", "purchase-orders"]) {
      expect((await b.get(`/api/export/${r}`)).status, r).toBe(403);
    }
  });

  it("sees only their own purchase requests, with no colleagues in the page", async () => {
    const { body } = await b.get("/en/purchasing/requests?pageSize=100");
    expect(distinct(body, /PR-[\w-]+/g)).toBe(0);
    expect(distinct(body, /EMP-\d{4}/g)).toBe(0);
  });

  it("gets no chart of accounts, vendors or colleagues when raising a request", async () => {
    const { body } = await b.get("/en/purchasing/requests/new");
    expect(body).not.toMatch(/\d{6} · /);
    expect(body).not.toMatch(/V-\d{4} · /);
    expect(distinct(body, /EMP-\d{4}/g)).toBeLessThanOrEqual(1);
  });

  it("sees only themselves on the self-service and leave pages", async () => {
    for (const p of ["/en/hr/self", "/en/hr/leave/new"]) {
      expect(distinct((await b.get(p)).body, /EMP-\d{4}/g), p).toBeLessThanOrEqual(1);
    }
  });
});

describe("departments stay in their lane", () => {
  it("sales", async () => {
    const b = await session("sales");
    await expectAccess(b, SALES_PAGES, "ok");
    await expectAccess(b, [...HR_COMPANY_WIDE, ...PURCHASING_STAFF, "/purchasing/requests", ...ADMIN_PAGES, "/finance/journals", "/finance/reports/trial-balance"], "forbidden");
  });

  it("purchasing", async () => {
    const b = await session("purchasing");
    await expectAccess(b, [...PURCHASING_STAFF, "/purchasing/requests"], "ok");
    await expectAccess(b, [...HR_COMPANY_WIDE, ...SALES_PAGES, ...ADMIN_PAGES, "/finance/journals"], "forbidden");
    expect(distinct((await b.get("/en/purchasing/requests?pageSize=100")).body, /PR-[\w-]+/g)).toBeGreaterThan(0);
  });

  it("hr", async () => {
    const b = await session("hr");
    await expectAccess(b, [...HR_COMPANY_WIDE, "/foundation/employees"], "ok");
    await expectAccess(b, [...SALES_PAGES, ...PURCHASING_STAFF, ...FINANCE_PAGES, ...ADMIN_PAGES], "forbidden");
  });

  it("finance", async () => {
    const b = await session("finance");
    await expectAccess(b, [...FINANCE_PAGES, "/foundation/accounts", "/purchasing/orders", "/sales/orders"], "ok");
    await expectAccess(b, [...HR_COMPANY_WIDE, ...ADMIN_PAGES, "/foundation/employees", "/sales/leads", "/sales/pipeline"], "forbidden");
  });

  it("admin sees everything", async () => {
    const b = await session("admin");
    await expectAccess(b, [...HR_COMPANY_WIDE, ...PURCHASING_STAFF, ...SALES_PAGES, ...FINANCE_PAGES, ...ADMIN_PAGES], "ok");
  });
});

describe("signed out", () => {
  it("every API route refuses anonymous callers", async () => {
    for (const p of ["/api/export/employees", "/api/pdf/list/employees", "/api/hr/wps/x", "/api/attachments/x", "/api/portal/invoice/x"]) {
      expect((await fetch(BASE + p, { redirect: "manual" })).status, p).toBe(401);
    }
  });

  it("cron refuses a missing secret, and the secret no longer works in the URL", async () => {
    expect((await fetch(`${BASE}/api/cron/tick`)).status).toBe(401);
    expect((await fetch(`${BASE}/api/cron/tick?secret=${process.env.CRON_SECRET ?? "x"}`)).status).toBe(401);
  });

  it("sign-in pages are public and the health check answers", async () => {
    for (const p of ["/en/login", "/en/forgot-password", "/en/reset-password", "/en/portal/login"]) {
      expect((await fetch(BASE + p, { redirect: "manual" })).status, p).toBe(200);
    }
    expect((await fetch(`${BASE}/api/health`)).status).toBe(200);
  });

  it("the portal and staff realms stay separate", async () => {
    const portal = new Browser();
    expect(await portal.signIn("portal@nakheel.example", "Portal@2026", "portal")).toBe(true);
    expect((await portal.get("/en/dashboard")).status).toBe(307);
    expect((await portal.get("/api/export/customers")).status).toBe(401);
  });
});
