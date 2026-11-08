import { z } from "zod";
import { prisma, type Tx } from "@/lib/prisma";
import { zStr, zOptStr } from "../_shared/crud";
import type { AppSession } from "@/core/auth/session";
import type { ColumnDef, ListParams, PagedResult } from "@/components/data-table/types";
import { orderByFrom, skipTake } from "@/components/data-table/types";
import { ROLE_TEMPLATES } from "@/core/rbac/permissions";

export const companySchema = z.object({
  id: z.string().nullable().optional(),
  code: zStr(20),
  nameAr: zStr(),
  nameEn: zStr(),
  crNumber: zOptStr(20),
  vatNumber: zOptStr(20),
  addressAr: zOptStr(),
  addressEn: zOptStr(),
  city: zOptStr(80),
  buildingNo: zOptStr(10),
  district: zOptStr(80),
  postalCode: zOptStr(10),
  country: z.string().trim().max(2).default("SA"),
  phone: zOptStr(30),
  email: z.string().trim().email().nullable().optional().or(z.literal("")).transform((v) => (v ? v : null)),
  website: zOptStr(200),
  baseCurrency: z.string().trim().length(3).default("SAR"),
  isActive: z.coerce.boolean().default(true),
});

export async function listCompanies(session: AppSession, p: ListParams): Promise<PagedResult<Record<string, unknown>>> {
  const where: Record<string, unknown> = { id: { in: session.companyIds } };
  if (p.q) where.OR = ["code", "nameAr", "nameEn", "crNumber", "vatNumber"].map((f) => ({ [f]: { contains: p.q, mode: "insensitive" } }));
  if (p.filters.isActive) where.isActive = p.filters.isActive === "true";
  const [rows, total] = await Promise.all([
    prisma.company.findMany({ where, orderBy: orderByFrom(p.sort, ["code", "nameAr", "nameEn"], { code: "asc" }), ...skipTake(p), include: { _count: { select: { branches: true, userCompanies: true } } } }),
    prisma.company.count({ where }),
  ]);
  return { rows: rows as unknown as Record<string, unknown>[], total, page: p.page, pageSize: p.pageSize };
}

/** Creates a company with default roles, SAR currency, tax codes, main branch and assigns the creator. */
export async function saveCompany(session: AppSession, input: z.infer<typeof companySchema>) {
  const { id, ...data } = input;
  if (id) {
    if (!session.companyIds.includes(id)) throw new Error("NOT_FOUND");
    return prisma.company.update({ where: { id }, data });
  }
  if (!session.isSuperAdmin) throw new Error("FORBIDDEN");
  return prisma.$transaction(async (tx) => {
    const company = await tx.company.create({ data });
    await bootstrapCompany(tx, company.id, session.userId);
    return company;
  });
}

/** Idempotent per-company defaults. Also used by the seed script. */
export async function bootstrapCompany(tx: Tx, companyId: string, adminUserId?: string) {
  await tx.currency.upsert({ where: { code: "SAR" }, create: { code: "SAR", nameAr: "ريال سعودي", nameEn: "Saudi Riyal", symbol: "﷼", decimals: 2 }, update: {} });
  await tx.companyCurrency.upsert({ where: { companyId_currencyCode: { companyId, currencyCode: "SAR" } }, create: { companyId, currencyCode: "SAR" }, update: {} });
  const taxDefaults = [
    { code: "VAT15", nameAr: "ضريبة القيمة المضافة 15%", nameEn: "VAT 15%", category: "STANDARD" as const, rate: 15, isDefault: true },
    { code: "VAT0", nameAr: "نسبة صفرية", nameEn: "Zero-rated", category: "ZERO_RATED" as const, rate: 0, isDefault: false },
    { code: "EXEMPT", nameAr: "معفاة", nameEn: "Exempt", category: "EXEMPT" as const, rate: 0, isDefault: false },
    { code: "OOS", nameAr: "خارج النطاق", nameEn: "Out of scope", category: "OUT_OF_SCOPE" as const, rate: 0, isDefault: false },
  ];
  for (const t of taxDefaults) {
    await tx.taxCode.upsert({ where: { companyId_code: { companyId, code: t.code } }, create: { companyId, ...t }, update: {} });
  }
  await tx.branch.upsert({ where: { companyId_code: { companyId, code: "MAIN" } }, create: { companyId, code: "MAIN", nameAr: "الفرع الرئيسي", nameEn: "Main branch", isMain: true }, update: {} });
  for (const [code, tpl] of Object.entries(ROLE_TEMPLATES)) {
    const role = await tx.role.upsert({
      where: { companyId_code: { companyId, code } },
      create: { companyId, code, nameAr: tpl.nameAr, nameEn: tpl.nameEn, isSystem: true },
      update: {},
    });
    const existing = await tx.rolePermission.count({ where: { roleId: role.id } });
    if (existing === 0) await tx.rolePermission.createMany({ data: tpl.permissions().map((permission) => ({ roleId: role.id, permission })), skipDuplicates: true });
    if (adminUserId && code === "ADMIN") {
      const uc = await tx.userCompany.upsert({ where: { userId_companyId: { userId: adminUserId, companyId } }, create: { userId: adminUserId, companyId }, update: {} });
      await tx.userCompanyRole.upsert({ where: { userCompanyId_roleId: { userCompanyId: uc.id, roleId: role.id } }, create: { userCompanyId: uc.id, roleId: role.id }, update: {} });
    }
  }
  const year = new Date().getFullYear();
  const fy = await tx.fiscalYear.upsert({
    where: { companyId_code: { companyId, code: String(year) } },
    create: { companyId, code: String(year), name: `FY ${year}`, startDate: new Date(Date.UTC(year, 0, 1)), endDate: new Date(Date.UTC(year, 11, 31)) },
    update: {},
  });
  const periods = await tx.fiscalPeriod.count({ where: { fiscalYearId: fy.id } });
  if (periods === 0) {
    await tx.fiscalPeriod.createMany({
      data: Array.from({ length: 12 }, (_, i) => ({
        fiscalYearId: fy.id,
        companyId,
        number: i + 1,
        name: `${year}-${String(i + 1).padStart(2, "0")}`,
        startDate: new Date(Date.UTC(year, i, 1)),
        endDate: new Date(Date.UTC(year, i + 1, 0)),
      })),
    });
  }
}

export function companyColumns(tf: (k: string) => string): ColumnDef[] {
  return [
    { key: "code", label: tf("code"), sortable: true },
    { key: "name", label: tf("name"), bilingual: "name" },
    { key: "crNumber", label: tf("crNumber") },
    { key: "vatNumber", label: tf("vatNumber") },
    { key: "city", label: tf("city") },
    { key: "baseCurrency", label: tf("baseCurrency"), align: "center" },
    { key: "branches", label: tf("branch"), path: "_count.branches", type: "number", align: "center" },
    { key: "isActive", label: tf("isActive"), type: "boolean", align: "center" },
  ];
}
