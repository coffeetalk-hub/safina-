"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import type { ActionIssue } from "@/core/validation-issues";

type Failed = { error: string; issues?: ActionIssue[] };

/** Array fields that hold a document's rows: an empty one means "nothing was added yet". */
const ROW_LISTS = new Set(["lines", "items", "allocations", "steps"]);
const MAX_SHOWN = 3;

const isIndex = (s: string) => /^\d+$/.test(s);
/** Last resort for a field with no label in the message files: "estimatedPrice" → "Estimated price". */
function humanize(key: string) {
  const words = key.replace(/([a-z0-9])([A-Z])/g, "$1 $2").toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * Turns a failed action result into a sentence a non-technical person can act on,
 * in the current language. Never shows raw validator output.
 *
 *   const errorText = useActionError();
 *   if (!res.ok) toast.error(errorText(res));
 */
export function useActionError() {
  const te = useTranslations("errors");
  const tf = useTranslations("fields");
  const tv = useTranslations("validation");

  return React.useMemo(() => {
    const label = (key: string): string => {
      for (const k of [key, key.replace(/Ids?$/, "")]) {
        if (!k) continue;
        if (tf.has(k)) return tf(k);
        if (tv.has(`fields.${k}`)) return tv(`fields.${k}`);
      }
      return humanize(key.replace(/Ids?$/, "") || key);
    };

    /** One problem as a sentence, e.g. "Line 2: Quantity must be greater than zero". */
    const issue = (i: ActionIssue): string => {
      if (te.has(i.code)) return te(i.code);
      const parts = i.path.split(".").filter((p) => p && p !== "_");
      const field = [...parts].reverse().find((p) => !isIndex(p));
      if (!field) return te("VALIDATION");
      const lastIsField = !isIndex(parts[parts.length - 1]);
      let text: string;
      if (i.code === "MIN_ITEMS" && lastIsField && ROW_LISTS.has(field) && (i.min ?? 1) <= 1) text = tv("NO_LINES");
      else text = tv(tv.has(i.code) ? i.code : "INVALID", { field: label(field), min: i.min ?? 0, max: i.max ?? 0 });
      const row = parts.find(isIndex);
      return row !== undefined && lastIsField && parts.indexOf(row) < parts.length - 1 ? `${tv("line", { n: Number(row) + 1 })}: ${text}` : text;
    };

    const message = (res: Failed): string => {
      if (res.issues?.length) {
        const all = [...new Set(res.issues.map(issue))];
        const shown = all.slice(0, MAX_SHOWN);
        if (all.length > shown.length) shown.push(tv("more", { count: all.length - shown.length }));
        return shown.join("\n");
      }
      if (res.error.startsWith("Forbidden")) return te("FORBIDDEN");
      return te.has(res.error) ? te(res.error) : res.error;
    };

    return Object.assign(message, { issue });
  }, [te, tf, tv]);
}
