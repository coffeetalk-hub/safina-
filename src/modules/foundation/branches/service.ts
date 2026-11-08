import { z } from "zod";
import { makeCrud, zStr, zOptStr } from "../_shared/crud";
import { prisma } from "@/lib/prisma";
import type { ColumnDef } from "@/components/data-table/types";

export const branchSchema = z.object({
  id: z.string().nullable().optional(),
  code: zStr(20),
  nameAr: zStr(),
  nameEn: zStr(),
  addressAr: zOptStr(),
  addressEn: zOptStr(),
  phone: zOptStr(30),
  isMain: z.coerce.boolean().default(false),
  isActive: z.coerce.boolean().default(true),
});

export const branches = makeCrud({
  model: "branch",
  resource: "branch",
  schema: branchSchema,
  searchFields: ["code", "nameAr", "nameEn"],
  sortFields: ["code", "nameAr", "nameEn"],
  defaultOrder: { code: "asc" },
  beforeSave: async (data, session, id) => {
    if (data.isMain) await prisma.branch.updateMany({ where: { companyId: session.companyId, id: id ? { not: id } : undefined }, data: { isMain: false } });
    return data;
  },
});

export function branchColumns(tf: (k: string) => string): ColumnDef[] {
  return [
    { key: "code", label: tf("code"), sortable: true },
    { key: "name", label: tf("name"), bilingual: "name" },
    { key: "phone", label: tf("phone") },
    { key: "address", label: tf("address"), bilingual: "address" },
    { key: "isMain", label: tf("isMain"), type: "boolean", align: "center" },
    { key: "isActive", label: tf("isActive"), type: "boolean", align: "center" },
  ];
}
