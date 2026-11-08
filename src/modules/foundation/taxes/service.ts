import { z } from "zod";
import { makeCrud, zStr } from "../_shared/crud";
import { prisma } from "@/lib/prisma";
import type { ColumnDef } from "@/components/data-table/types";

export const taxSchema = z.object({
  id: z.string().nullable().optional(),
  code: zStr(20),
  nameAr: zStr(),
  nameEn: zStr(),
  category: z.enum(["STANDARD", "ZERO_RATED", "EXEMPT", "OUT_OF_SCOPE"]),
  rate: z.coerce.number().min(0).max(100).default(0),
  isDefault: z.coerce.boolean().default(false),
  isActive: z.coerce.boolean().default(true),
});

export const taxes = makeCrud({
  model: "taxCode",
  resource: "tax",
  schema: taxSchema,
  searchFields: ["code", "nameAr", "nameEn"],
  sortFields: ["code", "rate", "category"],
  defaultOrder: { code: "asc" },
  beforeSave: async (data, session, id) => {
    if (data.category !== "STANDARD") data.rate = 0;
    if (data.isDefault) await prisma.taxCode.updateMany({ where: { companyId: session.companyId, id: id ? { not: id } : undefined }, data: { isDefault: false } });
    return data;
  },
});

export function taxColumns(tf: (k: string) => string): ColumnDef[] {
  return [
    { key: "code", label: tf("code"), sortable: true },
    { key: "name", label: tf("name"), bilingual: "name" },
    { key: "category", label: tf("category"), type: "enum", enumName: "TaxCategory" },
    { key: "rate", label: tf("ratePct"), type: "number", align: "end", sortable: true },
    { key: "isDefault", label: tf("isDefault"), type: "boolean", align: "center" },
    { key: "isActive", label: tf("isActive"), type: "boolean", align: "center" },
  ];
}
