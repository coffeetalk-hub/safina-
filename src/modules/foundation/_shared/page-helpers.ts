import { getLocale, getTranslations } from "next-intl/server";
import { forbidden } from "next/navigation";
import { requireSession, can, type AppSession } from "@/core/auth/session";
import { parseListParams, type ListParams } from "@/components/data-table/types";

export type SP = Promise<Record<string, string | string[] | undefined>>;

/** Page-level permission gate: renders the 403 page instead of throwing. */
export async function requirePagePermission(permission: string): Promise<AppSession> {
  const session = await requireSession();
  if (!can(session, permission)) forbidden();
  return session;
}

/** Standard boilerplate for list pages: auth + permission + locale + translations + list params. */
export async function listPage(resource: string, searchParams: SP) {
  const session = await requirePagePermission(`foundation.${resource}:view`);
  const [locale, sp, t, tf, te, tc] = await Promise.all([getLocale(), searchParams, getTranslations("foundation"), getTranslations("fields"), getTranslations("enums"), getTranslations("common")]);
  const params: ListParams = parseListParams(sp);
  const perms = {
    create: can(session, `foundation.${resource}:create`),
    edit: can(session, `foundation.${resource}:edit`),
    delete: can(session, `foundation.${resource}:delete`),
    approve: can(session, `foundation.${resource}:approve`),
  };
  return { session, locale, params, t, tf, te, tc, perms };
}

export function nameFor(locale: string) {
  return (r: { nameAr: string; nameEn: string } | null | undefined) => (r ? (locale === "ar" ? r.nameAr : r.nameEn) : "");
}

export function sessionLite(s: AppSession) {
  return { userId: s.userId, companyId: s.companyId };
}
