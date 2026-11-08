import { z } from "zod";
import { makeCrud, zStr, zOptStr, zDate } from "../_shared/crud";
import { allocateNumber } from "@/core/numbering";
import type { ColumnDef } from "@/components/data-table/types";

export const employeeSchema = z.object({
  id: z.string().nullable().optional(),
  code: z.string().trim().max(30).nullable().optional(),
  firstNameAr: zStr(80),
  lastNameAr: zStr(80),
  firstNameEn: zStr(80),
  lastNameEn: zStr(80),
  gender: z.enum(["MALE", "FEMALE"]).default("MALE"),
  nationality: z.string().trim().max(2).default("SA"),
  isSaudi: z.coerce.boolean().default(true),
  nationalId: zOptStr(20),
  dateOfBirth: zDate,
  email: z.string().trim().email().nullable().optional().or(z.literal("")).transform((v) => (v ? v : null)),
  phone: zOptStr(30),
  addressAr: zOptStr(),
  addressEn: zOptStr(),
  jobTitleAr: zOptStr(120),
  jobTitleEn: zOptStr(120),
  department: zOptStr(80),
  managerId: zOptStr(40),
  branchId: zOptStr(40),
  costCenterId: zOptStr(40),
  hireDate: zDate,
  terminationDate: zDate,
  status: z.enum(["ACTIVE", "ON_LEAVE", "SUSPENDED", "TERMINATED"]).default("ACTIVE"),
  bankName: zOptStr(120),
  iban: zOptStr(34),
  gosiNumber: zOptStr(30),
  isSalesperson: z.coerce.boolean().default(false),
  isActive: z.coerce.boolean().default(true),
});

export const employees = makeCrud({
  model: "employee",
  resource: "employee",
  schema: employeeSchema,
  searchFields: ["code", "firstNameAr", "lastNameAr", "firstNameEn", "lastNameEn", "nationalId", "email", "department"],
  sortFields: ["code", "firstNameEn", "lastNameEn", "hireDate", "department", "status"],
  defaultOrder: { code: "asc" },
  include: { branch: { select: { code: true, nameAr: true, nameEn: true } }, costCenter: { select: { code: true } }, manager: { select: { firstNameAr: true, lastNameAr: true, firstNameEn: true, lastNameEn: true } } },
  beforeSave: async (data, session, id) => {
    if (!id && !data.code) data.code = await allocateNumber(session.companyId, "EMPLOYEE");
    data.isSaudi = data.nationality === "SA";
    return data;
  },
});

export function employeeColumns(tf: (k: string) => string, locale: string): ColumnDef[] {
  const ar = locale === "ar";
  return [
    { key: "code", label: tf("code"), sortable: true },
    { key: "firstName", label: tf(ar ? "firstNameAr" : "firstNameEn"), bilingual: "firstName", sortable: !ar },
    { key: "lastName", label: tf(ar ? "lastNameAr" : "lastNameEn"), bilingual: "lastName", sortable: !ar },
    { key: "jobTitle", label: tf(ar ? "jobTitleAr" : "jobTitleEn"), bilingual: "jobTitle" },
    { key: "department", label: tf("department"), sortable: true },
    { key: "branch", label: tf("branch"), bilingual: "branch.name" },
    { key: "nationality", label: tf("nationality"), align: "center" },
    { key: "nationalId", label: tf("nationalId"), hidden: true },
    { key: "hireDate", label: tf("hireDate"), type: "date", sortable: true },
    { key: "status", label: tf("employeeStatus"), type: "enum", enumName: "EmployeeStatus", tones: { ACTIVE: "success", ON_LEAVE: "info", SUSPENDED: "warning", TERMINATED: "destructive" } },
    { key: "phone", label: tf("phone"), hidden: true },
    { key: "email", label: tf("email"), hidden: true },
    { key: "iban", label: tf("iban"), hidden: true },
    { key: "gosiNumber", label: tf("gosiNumber"), hidden: true },
  ];
}
