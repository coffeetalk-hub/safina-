import { prisma } from "@/lib/prisma";

/** Small lookup lists for selects, in the requested locale. */
export async function lookups(companyId: string, locale: string) {
  const name = (r: { nameAr: string; nameEn: string; code?: string }) => `${r.code ? r.code + " · " : ""}${locale === "ar" ? r.nameAr : r.nameEn}`;
  const [accounts, costCenters, taxCodes, branches, roles, users, currencies] = await Promise.all([
    prisma.account.findMany({ where: { companyId, isActive: true, isPostable: true }, orderBy: { code: "asc" }, select: { id: true, code: true, nameAr: true, nameEn: true, type: true } }),
    prisma.costCenter.findMany({ where: { companyId, isActive: true }, orderBy: { code: "asc" }, select: { id: true, code: true, nameAr: true, nameEn: true } }),
    prisma.taxCode.findMany({ where: { companyId, isActive: true }, orderBy: { code: "asc" }, select: { id: true, code: true, nameAr: true, nameEn: true, rate: true } }),
    prisma.branch.findMany({ where: { companyId, isActive: true }, orderBy: { code: "asc" }, select: { id: true, code: true, nameAr: true, nameEn: true } }),
    prisma.role.findMany({ where: { companyId }, orderBy: { code: "asc" }, select: { id: true, code: true, nameAr: true, nameEn: true } }),
    prisma.user.findMany({ where: { isActive: true, companies: { some: { companyId } } }, orderBy: { nameEn: "asc" }, select: { id: true, nameAr: true, nameEn: true, email: true } }),
    prisma.companyCurrency.findMany({ where: { companyId, isActive: true }, include: { currency: true } }),
  ]);
  const opt = (rows: { id: string; nameAr: string; nameEn: string; code?: string }[]) => rows.map((r) => ({ value: r.id, label: name(r) }));
  return {
    accounts: opt(accounts),
    accountsByType: (types: string[]) => opt(accounts.filter((a) => types.includes(a.type))),
    costCenters: opt(costCenters),
    taxCodes: opt(taxCodes),
    branches: opt(branches),
    roles: opt(roles),
    users: users.map((u) => ({ value: u.id, label: `${locale === "ar" ? u.nameAr : u.nameEn} (${u.email})` })),
    currencies: currencies.map((c) => ({ value: c.currencyCode, label: `${c.currencyCode} · ${locale === "ar" ? c.currency.nameAr : c.currency.nameEn}` })),
  };
}

export function enumOptions(t: (k: string) => string, prefix: string, values: readonly string[]) {
  return values.map((v) => ({ value: v, label: t(`${prefix}.${v}`) }));
}
