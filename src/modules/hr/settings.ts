import { z } from "zod";
import { prisma } from "@/lib/prisma";
import type { AppSession } from "@/core/auth/session";
import { makeCrud, zStr, zOptStr } from "@/modules/foundation/_shared/crud";
import type { ColumnDef } from "@/components/data-table/types";

export const hrSettingsSchema = z.object({
  workStart: z.string().regex(/^\d{2}:\d{2}$/), workEnd: z.string().regex(/^\d{2}:\d{2}$/),
  dailyHours: z.coerce.number().min(1).max(12), weekendDays: z.string().min(3), graceMinutes: z.coerce.number().int().min(0).max(120),
  overtimeMultiplier: z.coerce.number().min(1).max(3), daysPerMonth: z.coerce.number().int().min(28).max(31),
  annualLeaveDays: z.coerce.number().int().min(0).max(60), annualLeaveDaysAfter5y: z.coerce.number().int().min(0).max(60),
  sickFullPayDays: z.coerce.number().int().min(0), sickPartialPayDays: z.coerce.number().int().min(0), sickPartialPayPct: z.coerce.number().int().min(0).max(100), sickUnpaidDays: z.coerce.number().int().min(0),
  eosbWageBasis: z.enum(["BASIC", "BASIC_HOUSING", "FULL"]), gosiWageBasis: z.enum(["BASIC", "BASIC_HOUSING", "FULL"]),
  gosiMinWage: z.coerce.number().min(0), gosiMaxWage: z.coerce.number().min(0),
  wpsEstablishmentId: zOptStr(40), wpsBankCode: zOptStr(20), payDay: z.coerce.number().int().min(1).max(31),
});
export type HrSettingsInput = z.infer<typeof hrSettingsSchema>;

/** Creates the defaults only when missing: an upsert on every read would write an audit entry each time. */
export async function getHrSettings(companyId: string) {
  return (await prisma.hrSettings.findUnique({ where: { companyId } })) ?? prisma.hrSettings.upsert({ where: { companyId }, create: { companyId }, update: {} });
}
export async function saveHrSettings(session: AppSession, input: HrSettingsInput) {
  return prisma.hrSettings.upsert({ where: { companyId: session.companyId }, create: { companyId: session.companyId, ...input, updatedById: session.userId }, update: { ...input, updatedById: session.userId } });
}

/** GOSI rate rows (effective-dated). */
export const gosiRateSchema = z.object({ id: z.string().nullable().optional(), nationality: z.enum(["SAUDI", "NON_SAUDI"]), effectiveFrom: z.string().min(10), employeePension: z.coerce.number().min(0).max(100), employerPension: z.coerce.number().min(0).max(100), employeeSaned: z.coerce.number().min(0).max(100), employerSaned: z.coerce.number().min(0).max(100), employerHazard: z.coerce.number().min(0).max(100) });
export const gosiRates = makeCrud({ model: "gosiRate", resource: "payroll", schema: gosiRateSchema, searchFields: ["nationality"], sortFields: ["nationality", "effectiveFrom"], defaultOrder: { effectiveFrom: "desc" }, beforeSave: async (d) => ({ ...d, effectiveFrom: new Date(d.effectiveFrom) }) as unknown as typeof d });
export function gosiRateColumns(tf: (k: string) => string, t: (k: string) => string): ColumnDef[] {
  return [
    { key: "nationality", label: t("nationality"), type: "enum", enumName: "GosiNationality" },
    { key: "effectiveFrom", label: t("effectiveFrom"), type: "date", sortable: true },
    { key: "employeePension", label: t("gosi.employeePension"), type: "number", align: "end" }, { key: "employerPension", label: t("gosi.employerPension"), type: "number", align: "end" },
    { key: "employeeSaned", label: t("gosi.employeeSaned"), type: "number", align: "end" }, { key: "employerSaned", label: t("gosi.employerSaned"), type: "number", align: "end" },
    { key: "employerHazard", label: t("gosi.employerHazard"), type: "number", align: "end" },
  ];
}
/** Rates in force for a nationality at a date (latest effectiveFrom ≤ date). */
export async function gosiRatesFor(companyId: string, isSaudi: boolean, at: Date) {
  const r = await prisma.gosiRate.findFirst({ where: { companyId, nationality: isSaudi ? "SAUDI" : "NON_SAUDI", effectiveFrom: { lte: at } }, orderBy: { effectiveFrom: "desc" } });
  return r ? { employeePension: Number(r.employeePension), employerPension: Number(r.employerPension), employeeSaned: Number(r.employeeSaned), employerSaned: Number(r.employerSaned), employerHazard: Number(r.employerHazard) } : { employeePension: 0, employerPension: 0, employeeSaned: 0, employerSaned: 0, employerHazard: 0 };
}

export const holidaySchema = z.object({ id: z.string().nullable().optional(), date: z.string().min(10), nameAr: zStr(100), nameEn: zStr(100) });
export const holidays = makeCrud({ model: "publicHoliday", resource: "attendance", schema: holidaySchema, searchFields: ["nameAr", "nameEn"], sortFields: ["date"], defaultOrder: { date: "asc" }, beforeSave: async (d) => ({ ...d, date: new Date(d.date) }) as unknown as typeof d });
export function holidayColumns(tf: (k: string) => string): ColumnDef[] {
  return [{ key: "date", label: tf("date"), type: "date", sortable: true }, { key: "name", label: tf("name"), bilingual: "name" }];
}

export const payComponentSchema = z.object({ id: z.string().nullable().optional(), code: zStr(20), nameAr: zStr(100), nameEn: zStr(100), type: z.enum(["EARNING", "DEDUCTION"]).default("EARNING"), calc: z.enum(["FIXED", "PERCENT_OF_BASIC"]).default("FIXED"), defaultValue: z.coerce.number().min(0).default(0), isHousing: z.coerce.boolean().default(false), accountId: zOptStr(40), sortOrder: z.coerce.number().int().default(0), isActive: z.coerce.boolean().default(true) });
export const payComponents = makeCrud({ model: "payComponent", resource: "payroll", schema: payComponentSchema, searchFields: ["code", "nameAr", "nameEn"], sortFields: ["code", "type", "sortOrder"], defaultOrder: { sortOrder: "asc" } });
export function payComponentColumns(tf: (k: string) => string, t: (k: string) => string): ColumnDef[] {
  return [
    { key: "code", label: tf("code"), sortable: true }, { key: "name", label: tf("name"), bilingual: "name" },
    { key: "type", label: tf("type"), type: "enum", enumName: "PayComponentType", tones: { EARNING: "success", DEDUCTION: "destructive" } },
    { key: "calc", label: t("calc"), type: "enum", enumName: "PayComponentCalc" }, { key: "defaultValue", label: t("defaultValue"), type: "number", align: "end" },
    { key: "isHousing", label: t("isHousing"), type: "boolean" }, { key: "isActive", label: tf("isActive"), type: "boolean" },
  ];
}

export const leaveTypeSchema = z.object({ id: z.string().nullable().optional(), code: zStr(20), nameAr: zStr(100), nameEn: zStr(100), entitlementDays: z.coerce.number().int().min(0).default(0), isPaid: z.coerce.boolean().default(true), payPct: z.coerce.number().int().min(0).max(100).default(100), deductsBalance: z.coerce.boolean().default(true), requiresApproval: z.coerce.boolean().default(true), maxDaysPerRequest: z.coerce.number().int().min(1).nullable().optional(), isActive: z.coerce.boolean().default(true), sortOrder: z.coerce.number().int().default(0) });
export const leaveTypes = makeCrud({ model: "leaveType", resource: "leave", schema: leaveTypeSchema, searchFields: ["code", "nameAr", "nameEn"], sortFields: ["code", "sortOrder"], defaultOrder: { sortOrder: "asc" } });
export function leaveTypeColumns(tf: (k: string) => string, t: (k: string) => string): ColumnDef[] {
  return [
    { key: "code", label: tf("code"), sortable: true }, { key: "name", label: tf("name"), bilingual: "name" },
    { key: "entitlementDays", label: t("entitlementDays"), type: "number", align: "end" }, { key: "isPaid", label: t("isPaid"), type: "boolean" }, { key: "payPct", label: t("payPct"), type: "number", align: "end" },
    { key: "deductsBalance", label: t("deductsBalance"), type: "boolean" }, { key: "requiresApproval", label: t("requiresApproval"), type: "boolean" }, { key: "isActive", label: tf("isActive"), type: "boolean" },
  ];
}

/** Seed defaults for a company (idempotent): GOSI rates, pay components, leave types. Values per current GOSI / Labour Law — HR must verify. */
export async function ensureHrDefaults(companyId: string) {
  await getHrSettings(companyId);
  if ((await prisma.gosiRate.count({ where: { companyId } })) === 0) {
    await prisma.gosiRate.createMany({ data: [
      { companyId, nationality: "SAUDI", effectiveFrom: new Date("2024-01-01"), employeePension: 9, employerPension: 9, employeeSaned: 0.75, employerSaned: 0.75, employerHazard: 2 },
      { companyId, nationality: "NON_SAUDI", effectiveFrom: new Date("2024-01-01"), employeePension: 0, employerPension: 0, employeeSaned: 0, employerSaned: 0, employerHazard: 2 },
    ] });
  }
  if ((await prisma.payComponent.count({ where: { companyId } })) === 0) {
    await prisma.payComponent.createMany({ data: [
      { companyId, code: "HOUSING", nameAr: "بدل سكن", nameEn: "Housing allowance", type: "EARNING", calc: "PERCENT_OF_BASIC", defaultValue: 25, isHousing: true, sortOrder: 1 },
      { companyId, code: "TRANSPORT", nameAr: "بدل مواصلات", nameEn: "Transport allowance", type: "EARNING", calc: "PERCENT_OF_BASIC", defaultValue: 10, sortOrder: 2 },
      { companyId, code: "PHONE", nameAr: "بدل اتصالات", nameEn: "Phone allowance", type: "EARNING", calc: "FIXED", defaultValue: 200, sortOrder: 3 },
      { companyId, code: "OTHER_ALW", nameAr: "بدلات أخرى", nameEn: "Other allowances", type: "EARNING", calc: "FIXED", defaultValue: 0, sortOrder: 4 },
      { companyId, code: "MED_INS", nameAr: "استقطاع تأمين طبي", nameEn: "Medical insurance deduction", type: "DEDUCTION", calc: "FIXED", defaultValue: 0, sortOrder: 10 },
      { companyId, code: "PENALTY", nameAr: "جزاءات", nameEn: "Penalties", type: "DEDUCTION", calc: "FIXED", defaultValue: 0, sortOrder: 11 },
    ] });
  }
  if ((await prisma.leaveType.count({ where: { companyId } })) === 0) {
    await prisma.leaveType.createMany({ data: [
      { companyId, code: "ANNUAL", nameAr: "إجازة سنوية", nameEn: "Annual leave", entitlementDays: 21, isPaid: true, payPct: 100, deductsBalance: true, sortOrder: 1 },
      { companyId, code: "SICK", nameAr: "إجازة مرضية", nameEn: "Sick leave", entitlementDays: 120, isPaid: true, payPct: 100, deductsBalance: true, sortOrder: 2 },
      { companyId, code: "UNPAID", nameAr: "إجازة بدون راتب", nameEn: "Unpaid leave", entitlementDays: 0, isPaid: false, payPct: 0, deductsBalance: false, sortOrder: 3 },
      { companyId, code: "HAJJ", nameAr: "إجازة حج", nameEn: "Hajj leave", entitlementDays: 0, isPaid: true, payPct: 100, deductsBalance: false, maxDaysPerRequest: 15, sortOrder: 4 },
      { companyId, code: "MATERNITY", nameAr: "إجازة وضع", nameEn: "Maternity leave", entitlementDays: 0, isPaid: true, payPct: 100, deductsBalance: false, maxDaysPerRequest: 84, sortOrder: 5 },
      { companyId, code: "PATERNITY", nameAr: "إجازة مولود", nameEn: "Paternity leave", entitlementDays: 0, isPaid: true, payPct: 100, deductsBalance: false, maxDaysPerRequest: 3, sortOrder: 6 },
      { companyId, code: "MARRIAGE", nameAr: "إجازة زواج", nameEn: "Marriage leave", entitlementDays: 0, isPaid: true, payPct: 100, deductsBalance: false, maxDaysPerRequest: 5, sortOrder: 7 },
      { companyId, code: "BEREAVEMENT", nameAr: "إجازة وفاة", nameEn: "Bereavement leave", entitlementDays: 0, isPaid: true, payPct: 100, deductsBalance: false, maxDaysPerRequest: 5, sortOrder: 8 },
    ] });
  }
}
