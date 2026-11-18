import { describe, expect, it } from "vitest";
import { z } from "zod";
import { describeIssue } from "../src/core/validation-issues";

// Same shape as the purchase request schema (the module itself pulls in the auth stack, which unit tests do not load).
const lineSchema = z.object({ descriptionAr: z.string().min(1).max(500), descriptionEn: z.string().min(1).max(500), quantity: z.coerce.number().positive().default(1) });
const requestSchema = z.object({ requestDate: z.string().min(10), priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).default("NORMAL"), lines: z.array(lineSchema).min(1) });

/** Runs a schema the way runAction does and returns the plain-language issues. */
function issuesFor(schema: z.ZodTypeAny, input: unknown) {
  const parsed = schema.safeParse(input);
  if (parsed.success) return [];
  return parsed.error.issues.map((i) => describeIssue(i, input));
}

describe("validation issues shown to people", () => {
  it("an empty purchase request asks for items, not for an array", () => {
    const issues = issuesFor(requestSchema, { requestDate: "2026-11-18", lines: [] });
    expect(issues).toEqual([{ path: "lines", code: "MIN_ITEMS", min: 1 }]);
  });

  it("a blank or missing value is reported as required", () => {
    expect(issuesFor(requestSchema, { requestDate: "", lines: [{ descriptionAr: "قلم", descriptionEn: "Pen" }] })).toEqual([{ path: "requestDate", code: "REQUIRED" }]);
    expect(issuesFor(z.object({ name: z.string() }), {})).toEqual([{ path: "name", code: "REQUIRED" }]);
    expect(issuesFor(z.object({ kind: z.enum(["A", "B"]) }), { kind: null })).toEqual([{ path: "kind", code: "REQUIRED" }]);
  });

  it("names the line and the kind of problem", () => {
    const line = { descriptionAr: "قلم", descriptionEn: "Pen", quantity: 0 };
    expect(issuesFor(requestSchema, { requestDate: "2026-11-18", lines: [{ ...line, quantity: 2 }, line] })).toEqual([{ path: "lines.1.quantity", code: "POSITIVE" }]);
  });

  it("covers lengths, ranges, formats and options", () => {
    const schema = z.object({ email: z.string().email(), password: z.string().min(8), note: z.string().max(5), pct: z.number().min(1).max(100), kind: z.enum(["A", "B"]), n: z.number() });
    const issues = issuesFor(schema, { email: "not-an-email", password: "short", note: "too long", pct: 250, kind: "C", n: "abc" });
    expect(issues).toEqual([
      { path: "email", code: "INVALID_EMAIL" },
      { path: "password", code: "TOO_SHORT", min: 8 },
      { path: "note", code: "TOO_LONG", max: 5 },
      { path: "pct", code: "MAX_VALUE", max: 100 },
      { path: "kind", code: "INVALID_OPTION" },
      { path: "n", code: "INVALID_NUMBER" },
    ]);
  });

  it("passes through an error code a schema names itself", () => {
    const schema = z.object({ from: z.string(), to: z.string() }).refine((d) => d.to >= d.from, { message: "END_BEFORE_START", path: ["to"] });
    expect(issuesFor(schema, { from: "2026-02-01", to: "2026-01-01" })).toEqual([{ path: "to", code: "END_BEFORE_START" }]);
  });

  it("never leaks validator jargon as a code", () => {
    const codes = issuesFor(requestSchema, { lines: "nope", priority: 7 }).map((i) => i.code);
    for (const c of codes) expect(c).toMatch(/^[A-Z_]+$/);
  });
});
