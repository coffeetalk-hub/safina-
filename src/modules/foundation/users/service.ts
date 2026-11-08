import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/core/auth/config";
import type { AppSession } from "@/core/auth/session";
import { orderByFrom, skipTake, type ColumnDef, type ListParams, type PagedResult } from "@/components/data-table/types";

export const userSchema = z.object({
  id: z.string().nullable().optional(),
  email: z.string().trim().email().toLowerCase(),
  nameAr: z.string().trim().min(1).max(120),
  nameEn: z.string().trim().min(1).max(120),
  phone: z.string().trim().max(30).nullable().optional(),
  locale: z.enum(["ar", "en"]).default("ar"),
  password: z.string().min(8).max(100).nullable().optional().or(z.literal("")),
  isActive: z.coerce.boolean().default(true),
  isSuperAdmin: z.coerce.boolean().default(false),
  /** role ids in the ACTIVE company */
  roleIds: z.array(z.string()).default([]),
  /** additional company ids the user may access (super admin only manages this) */
  companyIds: z.array(z.string()).default([]),
});

const userWhere = (session: AppSession, p: ListParams) => {
  const where: Record<string, unknown> = { companies: { some: { companyId: session.companyId } } };
  if (p.q) where.OR = ["email", "nameAr", "nameEn", "phone"].map((f) => ({ [f]: { contains: p.q, mode: "insensitive" } }));
  if (p.filters.isActive) where.isActive = p.filters.isActive === "true";
  if (p.filters.roleId) where.companies = { some: { companyId: session.companyId, roles: { some: { roleId: p.filters.roleId } } } };
  return where;
};

const userInclude = () => ({
  companies: { include: { roles: { include: { role: { select: { id: true, code: true, nameAr: true, nameEn: true } } } }, company: { select: { id: true, code: true, nameAr: true, nameEn: true } } } },
});

function shape(u: Record<string, unknown>, companyId: string, locale: string) {
  const companies = u.companies as { companyId: string; company: { code: string; nameAr: string; nameEn: string }; roles: { role: { id: string; code: string; nameAr: string; nameEn: string } }[] }[];
  const here = companies.find((c) => c.companyId === companyId);
  return {
    ...u,
    companies: undefined,
    roleIds: here?.roles.map((r) => r.role.id) ?? [],
    rolesLabel: here?.roles.map((r) => (locale === "ar" ? r.role.nameAr : r.role.nameEn)).join("، ") ?? "",
    companyIds: companies.map((c) => c.companyId),
    companiesLabel: companies.map((c) => c.company.code).join(", "),
  };
}

export async function listUsers(session: AppSession, p: ListParams, locale: string): Promise<PagedResult<Record<string, unknown>>> {
  const where = userWhere(session, p);
  const [rows, total] = await Promise.all([
    prisma.user.findMany({ where, orderBy: orderByFrom(p.sort, ["email", "nameAr", "nameEn", "lastLoginAt", "createdAt"], { nameEn: "asc" }), ...skipTake(p), include: userInclude() }),
    prisma.user.count({ where }),
  ]);
  return { rows: rows.map((u) => shape(u as unknown as Record<string, unknown>, session.companyId, locale)), total, page: p.page, pageSize: p.pageSize };
}

export async function allUsers(session: AppSession, p: ListParams, locale: string) {
  const rows = await prisma.user.findMany({ where: userWhere(session, p), orderBy: { nameEn: "asc" }, take: 10_000, include: userInclude() });
  return rows.map((u) => shape(u as unknown as Record<string, unknown>, session.companyId, locale));
}

export async function saveUser(session: AppSession, input: z.infer<typeof userSchema>) {
  const { id, password, roleIds, companyIds, ...data } = input;
  if (data.isSuperAdmin && !session.isSuperAdmin) throw new Error("FORBIDDEN");
  const validRoles = await prisma.role.findMany({ where: { id: { in: roleIds }, companyId: session.companyId }, select: { id: true } });

  return prisma.$transaction(async (tx) => {
    let userId = id ?? null;
    if (userId) {
      const existing = await tx.user.findFirst({ where: { id: userId, companies: { some: { companyId: session.companyId } } } });
      if (!existing) throw new Error("NOT_FOUND");
      await tx.user.update({ where: { id: userId }, data: { ...data, ...(password ? { passwordHash: await hashPassword(password) } : {}) } });
    } else {
      if (!password) throw new Error("PASSWORD_REQUIRED");
      const u = await tx.user.create({ data: { ...data, passwordHash: await hashPassword(password), defaultCompanyId: session.companyId } });
      userId = u.id;
    }
    // company memberships: always the active company; super admins may add others
    const targetCompanies = new Set<string>([session.companyId]);
    if (session.isSuperAdmin) companyIds.forEach((c) => targetCompanies.add(c));
    else {
      const current = await tx.userCompany.findMany({ where: { userId }, select: { companyId: true } });
      current.forEach((c) => targetCompanies.add(c.companyId));
    }
    for (const companyId of targetCompanies) {
      await tx.userCompany.upsert({ where: { userId_companyId: { userId, companyId } }, create: { userId, companyId }, update: {} });
    }
    if (session.isSuperAdmin) {
      await tx.userCompany.deleteMany({ where: { userId, companyId: { notIn: [...targetCompanies] } } });
    }
    // roles in active company
    const uc = await tx.userCompany.findUniqueOrThrow({ where: { userId_companyId: { userId, companyId: session.companyId } } });
    await tx.userCompanyRole.deleteMany({ where: { userCompanyId: uc.id } });
    if (validRoles.length) await tx.userCompanyRole.createMany({ data: validRoles.map((r) => ({ userCompanyId: uc.id, roleId: r.id })) });
    return { id: userId };
  });
}

export async function removeUser(session: AppSession, id: string) {
  if (id === session.userId) throw new Error("CANNOT_DELETE_SELF");
  const u = await prisma.user.findFirst({ where: { id, companies: { some: { companyId: session.companyId } } } });
  if (!u) throw new Error("NOT_FOUND");
  // Remove from the active company only; soft-delete when no companies remain.
  await prisma.userCompany.deleteMany({ where: { userId: id, companyId: session.companyId } });
  const remaining = await prisma.userCompany.count({ where: { userId: id } });
  if (remaining === 0) await prisma.user.delete({ where: { id } });
  return true;
}

export async function changeOwnPassword(session: AppSession, currentPassword: string, newPassword: string) {
  const bcrypt = await import("bcryptjs");
  const u = await prisma.user.findUniqueOrThrow({ where: { id: session.userId } });
  if (!(await bcrypt.compare(currentPassword, u.passwordHash))) throw new Error("INVALID_PASSWORD");
  await prisma.user.update({ where: { id: u.id }, data: { passwordHash: await hashPassword(newPassword) } });
  return true;
}

export function userColumns(tf: (k: string) => string): ColumnDef[] {
  return [
    { key: "name", label: tf("name"), bilingual: "name", sortable: false },
    { key: "email", label: tf("email"), sortable: true },
    { key: "phone", label: tf("phone"), hidden: true },
    { key: "rolesLabel", label: tf("roles") },
    { key: "companiesLabel", label: tf("companies"), hidden: true },
    { key: "locale", label: tf("locale"), type: "enum", enumName: "Locale", align: "center" },
    { key: "isSuperAdmin", label: tf("isSuperAdmin"), type: "boolean", align: "center" },
    { key: "lastLoginAt", label: "Last login", type: "datetime", sortable: true },
    { key: "isActive", label: tf("isActive"), type: "boolean", align: "center" },
  ];
}
