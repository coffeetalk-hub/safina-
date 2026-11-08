import { prisma } from "@/lib/prisma";

export type Opt = { value: string; label: string; meta?: Record<string, unknown> };

/** Lookup lists for finance document editors (serialisable). */
export async function financeLookups(companyId: string, locale: string) {
  const ar = locale === "ar";
  const name = (r: { nameAr: string; nameEn: string }) => (ar ? r.nameAr : r.nameEn);
  const [accounts, costCenters, taxCodes, customers, vendors, bankAccounts, items, branches, employees, currencies] = await Promise.all([
    prisma.account.findMany({ where: { companyId, isActive: true, isPostable: true }, orderBy: { code: "asc" }, select: { id: true, code: true, nameAr: true, nameEn: true, type: true } }),
    prisma.costCenter.findMany({ where: { companyId, isActive: true }, orderBy: { code: "asc" }, select: { id: true, code: true, nameAr: true, nameEn: true } }),
    prisma.taxCode.findMany({ where: { companyId, isActive: true }, orderBy: { code: "asc" }, select: { id: true, code: true, nameAr: true, nameEn: true, rate: true, category: true, isDefault: true } }),
    prisma.customer.findMany({ where: { companyId, isActive: true }, orderBy: { code: "asc" }, select: { id: true, code: true, nameAr: true, nameEn: true, paymentTermsDays: true, currencyCode: true, creditLimit: true, blockOnCreditExceed: true, vatNumber: true } }),
    prisma.vendor.findMany({ where: { companyId, isActive: true }, orderBy: { code: "asc" }, select: { id: true, code: true, nameAr: true, nameEn: true, paymentTermsDays: true, currencyCode: true } }),
    prisma.bankAccount.findMany({ where: { companyId, isActive: true }, orderBy: { code: "asc" }, select: { id: true, code: true, nameAr: true, nameEn: true, currencyCode: true } }),
    prisma.item.findMany({ where: { companyId, isActive: true }, orderBy: { code: "asc" }, select: { id: true, code: true, nameAr: true, nameEn: true, salePrice: true, costPrice: true, taxCodeId: true, revenueAccountId: true, expenseAccountId: true, unit: true, isSellable: true, isPurchasable: true } }),
    prisma.branch.findMany({ where: { companyId, isActive: true }, orderBy: { code: "asc" }, select: { id: true, code: true, nameAr: true, nameEn: true } }),
    prisma.employee.findMany({ where: { companyId, isActive: true }, orderBy: { code: "asc" }, select: { id: true, code: true, firstNameAr: true, lastNameAr: true, firstNameEn: true, lastNameEn: true, isSalesperson: true } }),
    prisma.companyCurrency.findMany({ where: { companyId, isActive: true }, select: { currencyCode: true } }),
  ]);
  const lbl = (r: { code: string; nameAr: string; nameEn: string }) => `${r.code} · ${name(r)}`;
  return {
    accounts: accounts.map((a) => ({ value: a.id, label: lbl(a), meta: { type: a.type, code: a.code } })) as Opt[],
    costCenters: costCenters.map((c) => ({ value: c.id, label: lbl(c) })) as Opt[],
    taxCodes: taxCodes.map((t) => ({ value: t.id, label: `${t.code} (${Number(t.rate)}%)`, meta: { rate: Number(t.rate), category: t.category, isDefault: t.isDefault } })) as Opt[],
    customers: customers.map((c) => ({ value: c.id, label: lbl(c), meta: { terms: c.paymentTermsDays, currency: c.currencyCode, creditLimit: Number(c.creditLimit), block: c.blockOnCreditExceed, vat: c.vatNumber } })) as Opt[],
    vendors: vendors.map((v) => ({ value: v.id, label: lbl(v), meta: { terms: v.paymentTermsDays, currency: v.currencyCode } })) as Opt[],
    bankAccounts: bankAccounts.map((b) => ({ value: b.id, label: lbl(b), meta: { currency: b.currencyCode } })) as Opt[],
    items: items.map((i) => ({ value: i.id, label: lbl(i), meta: { nameAr: i.nameAr, nameEn: i.nameEn, salePrice: Number(i.salePrice), costPrice: Number(i.costPrice), taxCodeId: i.taxCodeId, revenueAccountId: i.revenueAccountId, expenseAccountId: i.expenseAccountId, unit: i.unit, sellable: i.isSellable, purchasable: i.isPurchasable } })) as Opt[],
    branches: branches.map((b) => ({ value: b.id, label: lbl(b) })) as Opt[],
    salespersons: employees.filter((e) => e.isSalesperson).map((e) => ({ value: e.id, label: `${e.code} · ${ar ? `${e.firstNameAr} ${e.lastNameAr}` : `${e.firstNameEn} ${e.lastNameEn}`}` })) as Opt[],
    employees: employees.map((e) => ({ value: e.id, label: `${e.code} · ${ar ? `${e.firstNameAr} ${e.lastNameAr}` : `${e.firstNameEn} ${e.lastNameEn}`}` })) as Opt[],
    currencies: currencies.map((c) => ({ value: c.currencyCode, label: c.currencyCode })) as Opt[],
  };
}
export type FinanceLookups = Awaited<ReturnType<typeof financeLookups>>;

/** What an employee raising their own purchase request may see: no accounts, parties, prices or colleagues. */
export function requesterLookups(lk: FinanceLookups, employeeId: string | null): FinanceLookups {
  return {
    ...lk,
    accounts: [], customers: [], vendors: [], bankAccounts: [], taxCodes: [], salespersons: [],
    employees: lk.employees.filter((e) => e.value === employeeId),
    items: lk.items.filter((i) => i.meta?.purchasable).map((i) => ({ value: i.value, label: i.label, meta: { nameAr: i.meta?.nameAr, nameEn: i.meta?.nameEn, unit: i.meta?.unit, purchasable: true } })),
  };
}

export { STATUS_TONES } from "./constants";
