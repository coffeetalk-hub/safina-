import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import type { AppSession } from "@/core/auth/session";
import { customerStatement } from "@/modules/finance/ar/invoices";

export const portalUserSchema = z.object({
  id: z.string().nullable().optional(),
  customerId: z.string().min(1),
  email: z.string().trim().email().toLowerCase(),
  name: z.string().trim().min(1).max(120),
  locale: z.enum(["ar", "en"]).default("ar"),
  password: z.string().min(8).max(100).nullable().optional().or(z.literal("")),
  isActive: z.coerce.boolean().default(true),
});
export async function listPortalUsers(session: AppSession) {
  return prisma.portalUser.findMany({ where: { companyId: session.companyId }, include: { customer: { select: { code: true, nameAr: true, nameEn: true } } }, orderBy: { createdAt: "desc" } });
}
export async function savePortalUser(session: AppSession, input: z.infer<typeof portalUserSchema>) {
  const { id, password, ...rest } = input;
  const c = await prisma.customer.findFirst({ where: { id: rest.customerId, companyId: session.companyId } });
  if (!c) throw new Error("NOT_FOUND");
  if (id) {
    const ex = await prisma.portalUser.findFirst({ where: { id, companyId: session.companyId } });
    if (!ex) throw new Error("NOT_FOUND");
    return prisma.portalUser.update({ where: { id }, data: { ...rest, ...(password ? { passwordHash: await bcrypt.hash(password, 10) } : {}) } });
  }
  if (!password) throw new Error("PASSWORD_REQUIRED");
  return prisma.portalUser.create({ data: { ...rest, companyId: session.companyId, passwordHash: await bcrypt.hash(password, 10) } });
}
export async function deletePortalUser(session: AppSession, id: string) {
  const ex = await prisma.portalUser.findFirst({ where: { id, companyId: session.companyId } });
  if (!ex) throw new Error("NOT_FOUND");
  return prisma.portalUser.delete({ where: { id } });
}

/** Data for the customer portal home: open/paid invoices and a statement for the current year. */
export async function portalHome(portal: { companyId: string; customerId: string }) {
  const year = new Date().getUTCFullYear();
  const from = new Date(Date.UTC(year, 0, 1));
  const s = { companyId: portal.companyId } as AppSession;
  const [customer, invoices, statement, company] = await Promise.all([
    prisma.customer.findUniqueOrThrow({ where: { id: portal.customerId } }),
    prisma.customerInvoice.findMany({ where: { companyId: portal.companyId, customerId: portal.customerId, status: { in: ["POSTED", "PARTIALLY_PAID", "PAID"] } }, orderBy: { invoiceDate: "desc" }, take: 200 }),
    customerStatement(s, portal.customerId, from, new Date()),
    prisma.company.findUniqueOrThrow({ where: { id: portal.companyId }, select: { nameAr: true, nameEn: true, phone: true, email: true } }),
  ]);
  return { customer, invoices, statement, company };
}
