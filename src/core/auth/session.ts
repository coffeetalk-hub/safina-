import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "./config";
import { prisma } from "@/lib/prisma";
import type { Permission } from "@/core/rbac/permissions";

export const ACTIVE_COMPANY_COOKIE = "safina_company";
export const ACTIVE_BRANCH_COOKIE = "safina_branch";

export type AppSession = {
  userId: string;
  email: string;
  nameAr: string;
  nameEn: string;
  locale: string;
  isSuperAdmin: boolean;
  companyIds: string[];
  companyId: string;
  branchId: string | null;
  permissions: Set<string>;
  ip?: string;
  userAgent?: string;
};

/**
 * Resolves the authenticated user, active company (cookie → token default) and the
 * flattened permission set for that company. Cached per request.
 */
export const getSession = cache(async (): Promise<AppSession | null> => {
  const s = await auth();
  if (!s?.user?.id || s.user.portal) return null;
  const jar = await cookies();
  const hdrs = await headers();

  let companyIds = s.user.companyIds;
  if (s.user.isSuperAdmin) {
    const all = await prisma.company.findMany({ select: { id: true }, where: { isActive: true } });
    companyIds = all.map((c) => c.id);
  }
  const cookieCompany = jar.get(ACTIVE_COMPANY_COOKIE)?.value;
  const companyId =
    cookieCompany && companyIds.includes(cookieCompany)
      ? cookieCompany
      : s.user.activeCompanyId && companyIds.includes(s.user.activeCompanyId)
        ? s.user.activeCompanyId
        : companyIds[0];
  if (!companyId) return null;

  const permissions = new Set<string>();
  if (s.user.isSuperAdmin) {
    permissions.add("*");
  } else {
    const uc = await prisma.userCompany.findUnique({
      where: { userId_companyId: { userId: s.user.id, companyId } },
      include: { roles: { include: { role: { include: { permissions: true } } } } },
    });
    uc?.roles.forEach((r) => r.role.permissions.forEach((p) => permissions.add(p.permission)));
  }

  return {
    userId: s.user.id,
    email: s.user.email ?? "",
    nameAr: s.user.nameAr,
    nameEn: s.user.nameEn,
    locale: s.user.locale,
    isSuperAdmin: s.user.isSuperAdmin,
    companyIds,
    companyId,
    branchId: jar.get(ACTIVE_BRANCH_COOKIE)?.value ?? null,
    permissions,
    ip: hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ?? undefined,
    userAgent: hdrs.get("user-agent") ?? undefined,
  };
});

export async function requireSession(): Promise<AppSession> {
  const s = await getSession();
  if (!s) redirect("/login");
  return s;
}

export function can(session: AppSession | null, permission: Permission | string): boolean {
  if (!session) return false;
  if (session.permissions.has("*")) return true;
  return session.permissions.has(permission);
}

export class ForbiddenError extends Error {
  constructor(public permission: string) {
    super(`Forbidden: ${permission}`);
  }
}

export async function requirePermission(permission: Permission | string): Promise<AppSession> {
  const s = await requireSession();
  if (!can(s, permission)) throw new ForbiddenError(permission);
  return s;
}

export type PortalSession = { portalUserId: string; customerId: string; companyId: string; email: string; nameAr: string; nameEn: string; locale: string };

/** Session for the customer portal realm (separate from staff sessions). */
export const getPortalSession = cache(async (): Promise<PortalSession | null> => {
  const s = await auth();
  if (!s?.user?.id || !s.user.portal || !s.user.customerId || !s.user.companyId) return null;
  return { portalUserId: s.user.id.replace(/^portal:/, ""), customerId: s.user.customerId, companyId: s.user.companyId, email: s.user.email ?? "", nameAr: s.user.nameAr, nameEn: s.user.nameEn, locale: s.user.locale };
});
