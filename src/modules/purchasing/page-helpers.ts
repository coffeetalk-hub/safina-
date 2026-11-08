import { getLocale, getTranslations } from "next-intl/server";
import { forbidden } from "next/navigation";
import { requireSession, can } from "@/core/auth/session";
import { parseListParams, type ListParams } from "@/components/data-table/types";
import type { SP } from "@/modules/foundation/_shared/page-helpers";

export type { SP };

export async function purchasingPage(resource: string, searchParams?: SP) {
  const session = await requireSession();
  if (!can(session, `purchasing.${resource}:view`)) forbidden();
  const [locale, sp, t, tf, te, tc, tfin] = await Promise.all([getLocale(), searchParams ?? Promise.resolve({}), getTranslations("purchasing"), getTranslations("fields"), getTranslations("enums"), getTranslations("common"), getTranslations("finance")]);
  const params: ListParams = parseListParams(sp);
  const perms = { create: can(session, `purchasing.${resource}:create`), edit: can(session, `purchasing.${resource}:edit`), delete: can(session, `purchasing.${resource}:delete`), approve: can(session, `purchasing.${resource}:approve`) };
  return { session, locale, params, t, tf, te, tc, tfin, perms };
}
