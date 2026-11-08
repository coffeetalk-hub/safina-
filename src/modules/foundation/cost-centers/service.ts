import { z } from "zod";
import { makeCrud, zStr, zOptStr } from "../_shared/crud";
import type { ColumnDef } from "@/components/data-table/types";

export const costCenterSchema = z.object({
  id: z.string().nullable().optional(),
  code: zStr(30),
  nameAr: zStr(),
  nameEn: zStr(),
  parentId: zOptStr(40),
  isActive: z.coerce.boolean().default(true),
});

export const costCenters = makeCrud({
  model: "costCenter",
  resource: "costCenter",
  schema: costCenterSchema,
  searchFields: ["code", "nameAr", "nameEn"],
  sortFields: ["code", "nameAr", "nameEn"],
  defaultOrder: { code: "asc" },
  include: { parent: { select: { code: true, nameAr: true, nameEn: true } } },
});

export function costCenterColumns(tf: (k: string) => string): ColumnDef[] {
  return [
    { key: "code", label: tf("code"), sortable: true },
    { key: "name", label: tf("name"), bilingual: "name" },
    { key: "parent", label: tf("parent"), path: "parent.code" },
    { key: "isActive", label: tf("isActive"), type: "boolean", align: "center" },
  ];
}
