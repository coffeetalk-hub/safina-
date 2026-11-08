import { getLocale, getTranslations } from "next-intl/server";
import { forbidden } from "next/navigation";
import { requireSession, can } from "@/core/auth/session";
import { parseListParams, type ListParams } from "@/components/data-table/types";
import type { SP } from "@/modules/foundation/_shared/page-helpers";

export type { SP };

/**
 * Page gate for HR screens. `hr.<resource>:view` opens the screen for the whole company.
 * Pass `selfService: true` only on single-record pages whose loader enforces ownership;
 * those also open for `hr.self:view`, and `perms.allEmployees` stays false.
 */
export async function hrPage(resource: string, searchParams?: SP, opts: { selfService?: boolean } = {}) {
  const session = await requireSession();
  const companyWide = can(session, `hr.${resource}:view`);
  const selfOnly = !companyWide && Boolean(opts.selfService) && can(session, "hr.self:view");
  if (!companyWide && !selfOnly) forbidden();
  const [locale, sp, t, tf, te, tc, tfin] = await Promise.all([getLocale(), searchParams ?? Promise.resolve({}), getTranslations("hr"), getTranslations("fields"), getTranslations("enums"), getTranslations("common"), getTranslations("finance")]);
  const params: ListParams = parseListParams(sp);
  const allowed = (action: "create" | "edit" | "delete") => can(session, `hr.${resource}:${action}`) || (selfOnly && resource === "leave" && can(session, `hr.self:${action}`));
  const perms = { create: allowed("create"), edit: allowed("edit"), delete: allowed("delete"), approve: can(session, `hr.${resource}:approve`), allEmployees: companyWide };
  return { session, locale, params, t, tf, te, tc, tfin, perms };
}
