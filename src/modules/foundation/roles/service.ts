import { z } from "zod";
import { prisma } from "@/lib/prisma";
import type { AppSession } from "@/core/auth/session";
import { allPermissions } from "@/core/rbac/permissions";

export const roleSchema = z.object({
  id: z.string().nullable().optional(),
  code: z.string().trim().min(1).max(30).toUpperCase(),
  nameAr: z.string().trim().min(1).max(100),
  nameEn: z.string().trim().min(1).max(100),
  description: z.string().trim().max(500).nullable().optional(),
  permissions: z.array(z.string()).default([]),
});

export async function listRoles(session: AppSession) {
  return prisma.role.findMany({
    where: { companyId: session.companyId },
    orderBy: { code: "asc" },
    include: { permissions: { select: { permission: true } }, _count: { select: { users: true } } },
  });
}

export async function saveRole(session: AppSession, input: z.infer<typeof roleSchema>) {
  const valid = new Set(allPermissions());
  const perms = input.permissions.filter((p) => valid.has(p as never));
  return prisma.$transaction(async (tx) => {
    let roleId = input.id ?? null;
    if (roleId) {
      const r = await tx.role.findFirst({ where: { id: roleId, companyId: session.companyId } });
      if (!r) throw new Error("NOT_FOUND");
      await tx.role.update({ where: { id: roleId }, data: { nameAr: input.nameAr, nameEn: input.nameEn, description: input.description, ...(r.isSystem ? {} : { code: input.code }) } });
    } else {
      const r = await tx.role.create({ data: { companyId: session.companyId, code: input.code, nameAr: input.nameAr, nameEn: input.nameEn, description: input.description } });
      roleId = r.id;
    }
    await tx.rolePermission.deleteMany({ where: { roleId } });
    if (perms.length) await tx.rolePermission.createMany({ data: perms.map((permission) => ({ roleId: roleId!, permission })) });
    return { id: roleId };
  });
}

export async function removeRole(session: AppSession, id: string) {
  const r = await prisma.role.findFirst({ where: { id, companyId: session.companyId }, include: { _count: { select: { users: true } } } });
  if (!r) throw new Error("NOT_FOUND");
  if (r.isSystem) throw new Error("SYSTEM_ROLE");
  if (r._count.users > 0) throw new Error("IN_USE");
  return prisma.role.delete({ where: { id } });
}
