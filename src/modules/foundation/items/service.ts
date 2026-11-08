import { z } from "zod";
import { makeCrud, zStr, zOptStr, zMoney } from "../_shared/crud";
import { allocateNumber } from "@/core/numbering";
import type { ColumnDef } from "@/components/data-table/types";

export const itemSchema = z.object({
  id: z.string().nullable().optional(),
  code: z.string().trim().max(30).nullable().optional(),
  nameAr: zStr(),
  nameEn: zStr(),
  descriptionAr: zOptStr(1000),
  descriptionEn: zOptStr(1000),
  type: z.enum(["SERVICE", "NON_STOCK"]).default("SERVICE"),
  unit: z.string().trim().max(10).default("EA"),
  salePrice: zMoney,
  costPrice: zMoney,
  taxCodeId: zOptStr(40),
  revenueAccountId: zOptStr(40),
  expenseAccountId: zOptStr(40),
  isSellable: z.coerce.boolean().default(true),
  isPurchasable: z.coerce.boolean().default(true),
  isActive: z.coerce.boolean().default(true),
});

export const items = makeCrud({
  model: "item",
  resource: "item",
  schema: itemSchema,
  searchFields: ["code", "nameAr", "nameEn", "descriptionAr", "descriptionEn"],
  sortFields: ["code", "nameAr", "nameEn", "salePrice", "costPrice", "createdAt"],
  defaultOrder: { code: "asc" },
  include: { taxCode: { select: { code: true, rate: true, nameAr: true, nameEn: true } } },
  beforeSave: async (data, session, id) => {
    if (!id && !data.code) data.code = await allocateNumber(session.companyId, "ITEM");
    return data;
  },
});

export function itemColumns(tf: (k: string) => string, locale: string): ColumnDef[] {
  return [
    { key: "code", label: tf("code"), sortable: true },
    { key: "name", label: tf("name"), bilingual: "name" },
    { key: "nameOther", label: locale === "ar" ? tf("nameEn") : tf("nameAr"), path: locale === "ar" ? "nameEn" : "nameAr", hidden: true },
    { key: "type", label: tf("type"), type: "enum", enumName: "ItemType" },
    { key: "unit", label: tf("unit") },
    { key: "salePrice", label: tf("salePrice"), type: "money", align: "end", sortable: true },
    { key: "costPrice", label: tf("costPrice"), type: "money", align: "end", sortable: true },
    { key: "taxCode", label: tf("taxCode"), path: "taxCode.code" },
    { key: "isSellable", label: tf("isSellable"), type: "boolean", align: "center", hidden: true },
    { key: "isPurchasable", label: tf("isPurchasable"), type: "boolean", align: "center", hidden: true },
    { key: "isActive", label: tf("isActive"), type: "boolean", align: "center" },
  ];
}
