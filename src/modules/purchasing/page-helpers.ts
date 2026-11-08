import { getLocale, getTranslations } from "next-intl/server";
import { forbidden } from "next/navigation";
import { requireSession, can } from "@/core/auth/session";
import { parseListParams, type ListParams } from "@/components/data-table/types";
import type { SP } from "@/modules/foundation/_shared/page-helpers";

export type { SP };

/**
 * Page gate for purchasing screens. `purchasing.<resource>:view` opens the screen for the whole company.
 * With `ownResource`, holders of `purchasing.<ownResource>:view` get in too and `ownOnly` is true:
 * the page's loaders must then restrict rows to what the user raised.
 */
export async function purchasingPage(resource: string, searchParams?: SP, opts: { ownResource?: string } = {}) {
  const session = await requireSession();
  const companyWide = can(session, `purchasing.${resource}:view`);
  const ownOnly = !companyWide && Boolean(opts.ownResource) && can(session, `purchasing.${opts.ownResource}:view`);
  if (!companyWide && !ownOnly) forbidden();
  const [locale, sp, t, tf, te, tc, tfin] = await Promise.all([getLocale(), searchParams ?? Promise.resolve({}), getTranslations("purchasing"), getTranslations("fields"), getTranslations("enums"), getTranslations("common"), getTranslations("finance")]);
  const params: ListParams = parseListParams(sp);
  const allowed = (action: string) => can(session, `purchasing.${resource}:${action}`) || (ownOnly && can(session, `purchasing.${opts.ownResource}:${action}`));
  const perms = { create: allowed("create"), edit: allowed("edit"), delete: allowed("delete"), approve: can(session, `purchasing.${resource}:approve`) };
  return { session, locale, params, t, tf, te, tc, tfin, perms, ownOnly };
}
