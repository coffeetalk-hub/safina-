import { z } from "zod";
import { makeCrud, zStr, zOptStr } from "../_shared/crud";
import { allocateNumber } from "@/core/numbering";
import type { ColumnDef } from "@/components/data-table/types";

export const vendorSchema = z.object({
  id: z.string().nullable().optional(),
  code: z.string().trim().max(30).nullable().optional(),
  nameAr: zStr(),
  nameEn: zStr(),
  type: z.enum(["COMPANY", "INDIVIDUAL", "GOVERNMENT"]).default("COMPANY"),
  vatNumber: zOptStr(20),
  crNumber: zOptStr(20),
  email: z.string().trim().email().nullable().optional().or(z.literal("")).transform((v) => (v ? v : null)),
  phone: zOptStr(30),
  mobile: zOptStr(30),
  addressAr: zOptStr(),
  addressEn: zOptStr(),
  city: zOptStr(80),
  country: z.string().trim().max(2).default("SA"),
  contactPerson: zOptStr(120),
  paymentTermsDays: z.coerce.number().int().min(0).max(365).default(30),
  currencyCode: z.string().trim().max(3).default("SAR"),
  payableAccountId: zOptStr(40),
  bankName: zOptStr(120),
  iban: zOptStr(34),
  notes: zOptStr(2000),
  isActive: z.coerce.boolean().default(true),
});

export const vendors = makeCrud({
  model: "vendor",
  resource: "vendor",
  schema: vendorSchema,
  searchFields: ["code", "nameAr", "nameEn", "vatNumber", "email", "phone", "iban"],
  sortFields: ["code", "nameAr", "nameEn", "city", "createdAt"],
  defaultOrder: { code: "asc" },
  beforeSave: async (data, session, id) => {
    if (!id && !data.code) data.code = await allocateNumber(session.companyId, "VENDOR");
    return data;
  },
});

export function vendorColumns(tf: (k: string) => string, locale: string): ColumnDef[] {
  return [
    { key: "code", label: tf("code"), sortable: true },
    { key: "name", label: tf("name"), bilingual: "name" },
    { key: "nameOther", label: locale === "ar" ? tf("nameEn") : tf("nameAr"), path: locale === "ar" ? "nameEn" : "nameAr", hidden: true },
    { key: "type", label: tf("type"), type: "enum", enumName: "PartyType" },
    { key: "vatNumber", label: tf("vatNumber") },
    { key: "city", label: tf("city"), sortable: true },
    { key: "phone", label: tf("phone") },
    { key: "email", label: tf("email") },
    { key: "paymentTermsDays", label: tf("paymentTermsDays"), type: "number", align: "end" },
    { key: "bankName", label: tf("bankName"), hidden: true },
    { key: "iban", label: tf("iban"), hidden: true },
    { key: "isActive", label: tf("isActive"), type: "boolean", align: "center" },
  ];
}
