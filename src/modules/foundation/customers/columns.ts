import type { ColumnDef } from "@/components/data-table/types";

type TF = (k: string) => string;

export function customerColumns(tf: TF, locale: string): ColumnDef[] {
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
    { key: "creditLimit", label: tf("creditLimit"), type: "money", align: "end", sortable: true },
    { key: "isActive", label: tf("isActive"), type: "boolean", align: "center" },
  ];
}
