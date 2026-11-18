import type { z } from "zod";

/**
 * A validation problem in a form people can read. `code` is a key under `validation.*`
 * in the message files (or an `errors.*` key when a schema supplies its own code);
 * the client turns it into a sentence with the field's label.
 */
export type ActionIssue = { path: string; code: string; min?: number; max?: number };

const isCode = (s: string) => /^[A-Z][A-Z0-9_]+$/.test(s);

function valueAt(input: unknown, path: readonly PropertyKey[]): unknown {
  let v = input;
  for (const k of path) {
    if (v === null || typeof v !== "object") return undefined;
    v = (v as Record<PropertyKey, unknown>)[k];
  }
  return v;
}

/** Maps one Zod issue to a plain-language code. `input` is the value that was validated. */
export function describeIssue(issue: z.core.$ZodIssue, input: unknown): ActionIssue {
  const path = issue.path.map(String).join(".");
  // Schemas may name their own error (e.g. "END_BEFORE_START"): pass it through.
  if (isCode(issue.message)) return { path, code: issue.message };
  const value = valueAt(input, issue.path);
  const missing = value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0);

  switch (issue.code) {
    case "too_small": {
      const min = Number(issue.minimum);
      if (issue.origin === "array" || issue.origin === "set") return { path, code: "MIN_ITEMS", min };
      if (issue.origin === "string") return missing || min <= 1 ? { path, code: "REQUIRED" } : { path, code: "TOO_SHORT", min };
      if (issue.origin === "date") return { path, code: "INVALID_DATE" };
      return min === 0 && !issue.inclusive ? { path, code: "POSITIVE" } : { path, code: "MIN_VALUE", min };
    }
    case "too_big": {
      const max = Number(issue.maximum);
      if (issue.origin === "array" || issue.origin === "set") return { path, code: "MAX_ITEMS", max };
      if (issue.origin === "string") return { path, code: "TOO_LONG", max };
      if (issue.origin === "date") return { path, code: "INVALID_DATE" };
      return { path, code: "MAX_VALUE", max };
    }
    case "invalid_type":
      if (missing) return { path, code: "REQUIRED" };
      if (["number", "int", "bigint", "nan"].includes(issue.expected)) return { path, code: "INVALID_NUMBER" };
      if (issue.expected === "date") return { path, code: "INVALID_DATE" };
      return { path, code: "INVALID" };
    case "invalid_format":
      if (missing) return { path, code: "REQUIRED" };
      if (issue.format === "email") return { path, code: "INVALID_EMAIL" };
      if (["date", "datetime", "time"].includes(issue.format)) return { path, code: "INVALID_DATE" };
      return { path, code: "INVALID" };
    case "invalid_value":
      return { path, code: missing ? "REQUIRED" : "INVALID_OPTION" };
    default:
      return { path, code: missing ? "REQUIRED" : "INVALID" };
  }
}
