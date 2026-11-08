import { z } from "zod";
import { makeCrud, zStr, zOptStr } from "../_shared/crud";
import { prisma } from "@/lib/prisma";
import type { ColumnDef } from "@/components/data-table/types";
import type { AppSession } from "@/core/auth/session";

export const accountSchema = z.object({
  id: z.string().nullable().optional(),
  code: zStr(20),
  nameAr: zStr(),
  nameEn: zStr(),
  type: z.enum(["ASSET", "LIABILITY", "EQUITY", "REVENUE", "EXPENSE"]),
  parentId: zOptStr(40),
  isPostable: z.coerce.boolean().default(true),
  isControl: z.coerce.boolean().default(false),
  currencyCode: zOptStr(3),
  isActive: z.coerce.boolean().default(true),
});

export const accounts = makeCrud({
  model: "account",
  resource: "account",
  schema: accountSchema,
  searchFields: ["code", "nameAr", "nameEn"],
  sortFields: ["code", "nameAr", "nameEn", "type", "level"],
  defaultOrder: { code: "asc" },
  include: { parent: { select: { code: true, nameAr: true, nameEn: true } } },
  beforeSave: async (data, session) => {
    if (data.parentId) {
      const parent = await prisma.account.findFirst({ where: { id: data.parentId, companyId: session.companyId } });
      if (!parent) throw new Error("NOT_FOUND");
      // parent becomes a header account
      if (parent.isPostable) await prisma.account.update({ where: { id: parent.id }, data: { isPostable: false } });
      return { ...data, level: parent.level + 1 } as typeof data;
    }
    return { ...data, level: 1 } as typeof data;
  },
});

export function accountColumns(tf: (k: string) => string): ColumnDef[] {
  return [
    { key: "code", label: tf("code"), sortable: true },
    { key: "name", label: tf("name"), bilingual: "name" },
    { key: "type", label: tf("accountType"), type: "enum", enumName: "AccountType", tones: { ASSET: "info", LIABILITY: "warning", EQUITY: "secondary", REVENUE: "success", EXPENSE: "destructive" } },
    { key: "parent", label: tf("parent"), path: "parent.code" },
    { key: "level", label: tf("level"), type: "number", align: "center", sortable: true },
    { key: "isPostable", label: tf("isPostable"), type: "boolean", align: "center" },
    { key: "isControl", label: tf("isControl"), type: "boolean", align: "center", hidden: true },
    { key: "isActive", label: tf("isActive"), type: "boolean", align: "center" },
  ];
}

/** Keys the posting engine expects in AccountMapping. */
export const MAPPING_KEYS = [
  "AR", "AP", "VAT_INPUT", "VAT_OUTPUT", "SALES_REVENUE", "SALES_DISCOUNT", "PURCHASE_EXPENSE", "BANK_DEFAULT", "CASH", "PETTY_CASH",
  "RETAINED_EARNINGS", "FX_GAIN", "FX_LOSS", "ROUNDING", "ACCUM_DEPRECIATION", "DEPRECIATION_EXPENSE", "FIXED_ASSETS",
  "SALARIES_EXPENSE", "SALARIES_PAYABLE", "GOSI_EXPENSE", "GOSI_PAYABLE", "EOSB_EXPENSE", "EOSB_PROVISION", "EMPLOYEE_LOANS",
  "OPENING_BALANCE", "UNEARNED_REVENUE", "ADVANCES_TO_VENDORS", "ADVANCES_FROM_CUSTOMERS", "VAT_PAYABLE", "OTHER_INCOME", "OTHER_EXPENSE",
] as const;
export type MappingKey = (typeof MAPPING_KEYS)[number];

export async function getMappings(companyId: string) {
  const rows = await prisma.accountMapping.findMany({ where: { companyId }, include: { account: { select: { id: true, code: true, nameAr: true, nameEn: true } } } });
  return Object.fromEntries(rows.map((r) => [r.key, r.account]));
}

export async function saveMappings(session: AppSession, mappings: Record<string, string | null>) {
  for (const [key, accountId] of Object.entries(mappings)) {
    if (!MAPPING_KEYS.includes(key as MappingKey)) continue;
    if (!accountId) {
      await prisma.accountMapping.deleteMany({ where: { companyId: session.companyId, key } });
      continue;
    }
    const acc = await prisma.account.findFirst({ where: { id: accountId, companyId: session.companyId } });
    if (!acc) throw new Error("NOT_FOUND");
    await prisma.accountMapping.upsert({
      where: { companyId_key: { companyId: session.companyId, key } },
      create: { companyId: session.companyId, key, accountId },
      update: { accountId },
    });
  }
  return true;
}
