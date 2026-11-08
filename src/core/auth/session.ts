import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "./config";
import { clientIp } from "./client-ip";
import { prisma } from "@/lib/prisma";
import type { Permission } from "@/core/rbac/permissions";

export const ACTIVE_COMPANY_COOKIE = "safina_company";
export const ACTIVE_BRANCH_COOKIE = "safina_branch";

/** True when a session token predates the account's last password reset. `iat` has one-second resolution. */
function issuedBefore(tokenIssuedAt: number | undefined, passwordChangedAt: Date | null) {
  return Boolean(passwordChangedAt && tokenIssuedAt && tokenIssuedAt < Math.floor(passwordChangedAt.getTime() / 1000));
}

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
  // The JWT lives for hours: deactivated users and reset passwords must take effect immediately.
  const account = await prisma.user.findFirst({ where: { id: s.user.id, isActive: true }, select: { passwordChangedAt: true } });
  if (!account || issuedBefore(s.user.tokenIssuedAt, account.passwordChangedAt)) return null;
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
    ip: clientIp(hdrs) ?? undefined,
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

/** True when the session holds at least one of the given permissions. */
export function canAny(session: AppSession | null, permission: string | readonly string[]): boolean {
  return typeof permission === "string" ? can(session, permission) : permission.some((p) => can(session, p));
}

export class ForbiddenError extends Error {
  constructor(public permission: string) {
    super(`Forbidden: ${permission}`);
  }
}

export async function requirePermission(permission: string | readonly string[]): Promise<AppSession> {
  const s = await requireSession();
  if (!canAny(s, permission)) throw new ForbiddenError(String(permission));
  return s;
}

export type PortalSession = { portalUserId: string; customerId: string; companyId: string; email: string; nameAr: string; nameEn: string; locale: string };

/** Session for the customer portal realm (separate from staff sessions). */
export const getPortalSession = cache(async (): Promise<PortalSession | null> => {
  const s = await auth();
  if (!s?.user?.id || !s.user.portal || !s.user.customerId || !s.user.companyId) return null;
  const account = await prisma.portalUser.findFirst({ where: { id: s.user.id.replace(/^portal:/, ""), isActive: true }, select: { passwordChangedAt: true } });
  if (!account || issuedBefore(s.user.tokenIssuedAt, account.passwordChangedAt)) return null;
  return { portalUserId: s.user.id.replace(/^portal:/, ""), customerId: s.user.customerId, companyId: s.user.companyId, email: s.user.email ?? "", nameAr: s.user.nameAr, nameEn: s.user.nameEn, locale: s.user.locale };
});
