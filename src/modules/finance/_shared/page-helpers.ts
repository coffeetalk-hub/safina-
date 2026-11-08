import { getLocale, getTranslations } from "next-intl/server";
import { forbidden } from "next/navigation";
import { requireSession, can, type AppSession } from "@/core/auth/session";
import { parseListParams, type ListParams } from "@/components/data-table/types";
import type { SP } from "@/modules/foundation/_shared/page-helpers";

export type { SP };

export async function financePage(resource: string, searchParams?: SP) {
  const session = await requireSession();
  if (!can(session, `finance.${resource}:view`)) forbidden();
  const [locale, sp, t, tf, te, tc] = await Promise.all([getLocale(), searchParams ?? Promise.resolve({}), getTranslations("finance"), getTranslations("fields"), getTranslations("enums"), getTranslations("common")]);
  const params: ListParams = parseListParams(sp);
  const perms = {
    create: can(session, `finance.${resource}:create`),
    edit: can(session, `finance.${resource}:edit`),
    delete: can(session, `finance.${resource}:delete`),
    approve: can(session, `finance.${resource}:approve`),
  };
  return { session, locale, params, t, tf, te, tc, perms };
}

export function isoDay(d: Date | string | null | undefined) {
  if (!d) return "";
  return (typeof d === "string" ? d : d.toISOString()).slice(0, 10);
}

export function today() {
  return new Date().toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number) {
  const d = new Date(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function monthRange(d = new Date()) {
  const from = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
  const to = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0));
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

export function yearRange(d = new Date()) {
  return { from: `${d.getUTCFullYear()}-01-01`, to: `${d.getUTCFullYear()}-12-31` };
}

export { type AppSession };
