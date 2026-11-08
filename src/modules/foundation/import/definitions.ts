import { z } from "zod";
import { prisma } from "@/lib/prisma";
import type { ImportDefinition } from "@/core/import";
import { customerSchema } from "../customers/service";
import { vendorSchema } from "../vendors/service";
import { itemSchema } from "../items/service";
import { employeeSchema } from "../employees/service";
import { allocateNumber } from "@/core/numbering";

const bil = (key: string, ar: string, en: string, required = false, example?: string) => ({ key, labelAr: ar, labelEn: en, required, example });

const partyColumns = [
  bil("code", "الرمز", "Code", false, "C-0001"),
  bil("nameAr", "الاسم (عربي)", "Name (Arabic)", true, "شركة المثال"),
  bil("nameEn", "الاسم (إنجليزي)", "Name (English)", true, "Example Co."),
  bil("type", "النوع", "Type (COMPANY/INDIVIDUAL/GOVERNMENT)", false, "COMPANY"),
  bil("vatNumber", "الرقم الضريبي", "VAT number", false, "300000000000003"),
  bil("crNumber", "السجل التجاري", "CR number"),
  bil("email", "البريد", "Email"),
  bil("phone", "الهاتف", "Phone"),
  bil("mobile", "الجوال", "Mobile"),
  bil("city", "المدينة", "City", false, "Riyadh"),
  bil("addressAr", "العنوان (عربي)", "Address (Arabic)"),
  bil("addressEn", "العنوان (إنجليزي)", "Address (English)"),
  bil("contactPerson", "جهة الاتصال", "Contact person"),
  bil("paymentTermsDays", "شروط السداد (أيام)", "Payment terms (days)", false, "30"),
];

export const customersImport: ImportDefinition = {
  entity: "customers",
  permission: "foundation.customer:create",
  columns: [...partyColumns, bil("creditLimit", "الحد الائتماني", "Credit limit", false, "50000")],
  rowSchema: customerSchema.partial({ type: true }).extend({ type: z.string().optional().transform((v) => (v ? v.toUpperCase() : "COMPANY")) }),
  upsert: async (s, row) => {
    const data = customerSchema.parse(row);
    const code = data.code || (await allocateNumber(s.companyId, "CUSTOMER"));
    const { id: _id, ...rest } = data;
    void _id;
    await prisma.customer.upsert({ where: { companyId_code: { companyId: s.companyId, code } }, create: { ...rest, code, companyId: s.companyId, createdById: s.userId }, update: { ...rest, code, updatedById: s.userId } });
  },
};

export const vendorsImport: ImportDefinition = {
  entity: "vendors",
  permission: "foundation.vendor:create",
  columns: [...partyColumns, bil("bankName", "البنك", "Bank"), bil("iban", "الآيبان", "IBAN")],
  rowSchema: vendorSchema.partial({ type: true }).extend({ type: z.string().optional().transform((v) => (v ? v.toUpperCase() : "COMPANY")) }),
  upsert: async (s, row) => {
    const data = vendorSchema.parse(row);
    const code = data.code || (await allocateNumber(s.companyId, "VENDOR"));
    const { id: _id, ...rest } = data;
    void _id;
    await prisma.vendor.upsert({ where: { companyId_code: { companyId: s.companyId, code } }, create: { ...rest, code, companyId: s.companyId, createdById: s.userId }, update: { ...rest, code, updatedById: s.userId } });
  },
};

export const itemsImport: ImportDefinition = {
  entity: "items",
  permission: "foundation.item:create",
  columns: [
    bil("code", "الرمز", "Code", false, "SRV-001"),
    bil("nameAr", "الاسم (عربي)", "Name (Arabic)", true, "خدمة استشارية"),
    bil("nameEn", "الاسم (إنجليزي)", "Name (English)", true, "Consulting service"),
    bil("type", "النوع", "Type (SERVICE/NON_STOCK)", false, "SERVICE"),
    bil("unit", "الوحدة", "Unit", false, "HR"),
    bil("salePrice", "سعر البيع", "Sale price", false, "500"),
    bil("costPrice", "سعر التكلفة", "Cost price", false, "300"),
    bil("taxCode", "رمز الضريبة", "Tax code", false, "VAT15"),
    bil("descriptionAr", "الوصف (عربي)", "Description (Arabic)"),
    bil("descriptionEn", "الوصف (إنجليزي)", "Description (English)"),
  ],
  rowSchema: itemSchema.omit({ taxCodeId: true }).partial({ type: true }).extend({ type: z.string().optional().transform((v) => (v ? v.toUpperCase() : "SERVICE")), taxCode: z.string().optional().nullable() }),
  prepare: async (s) => new Map((await prisma.taxCode.findMany({ where: { companyId: s.companyId } })).map((t) => [t.code, t.id])),
  upsert: async (s, row, ctx) => {
    const { taxCode, ...r } = row as Record<string, unknown> & { taxCode?: string | null };
    const taxCodeId = taxCode ? (ctx.get(taxCode) as string | undefined) : undefined;
    if (taxCode && !taxCodeId) throw new Error(`Unknown tax code ${taxCode}`);
    const data = itemSchema.parse({ ...r, taxCodeId: taxCodeId ?? null });
    const code = data.code || (await allocateNumber(s.companyId, "ITEM"));
    const { id: _id, ...rest } = data;
    void _id;
    await prisma.item.upsert({ where: { companyId_code: { companyId: s.companyId, code } }, create: { ...rest, code, companyId: s.companyId, createdById: s.userId }, update: { ...rest, code, updatedById: s.userId } });
  },
};

export const employeesImport: ImportDefinition = {
  entity: "employees",
  permission: "foundation.employee:create",
  columns: [
    bil("code", "الرمز", "Code", false, "EMP-0001"),
    bil("firstNameAr", "الاسم الأول (عربي)", "First name (Arabic)", true, "محمد"),
    bil("lastNameAr", "اسم العائلة (عربي)", "Last name (Arabic)", true, "العلي"),
    bil("firstNameEn", "الاسم الأول (إنجليزي)", "First name (English)", true, "Mohammed"),
    bil("lastNameEn", "اسم العائلة (إنجليزي)", "Last name (English)", true, "Alali"),
    bil("gender", "الجنس", "Gender (MALE/FEMALE)", false, "MALE"),
    bil("nationality", "الجنسية", "Nationality (ISO2)", false, "SA"),
    bil("nationalId", "الهوية/الإقامة", "National ID / Iqama", false, "1000000001"),
    bil("dateOfBirth", "تاريخ الميلاد", "Date of birth", false, "1990-01-15"),
    bil("email", "البريد", "Email"),
    bil("phone", "الهاتف", "Phone"),
    bil("jobTitleAr", "المسمى (عربي)", "Job title (Arabic)"),
    bil("jobTitleEn", "المسمى (إنجليزي)", "Job title (English)"),
    bil("department", "القسم", "Department"),
    bil("branch", "الفرع", "Branch code", false, "MAIN"),
    bil("costCenter", "مركز التكلفة", "Cost center code"),
    bil("hireDate", "تاريخ التعيين", "Hire date", false, "2024-03-01"),
    bil("iban", "الآيبان", "IBAN"),
    bil("gosiNumber", "رقم التأمينات", "GOSI number"),
  ],
  rowSchema: employeeSchema.omit({ branchId: true, costCenterId: true }).partial({ gender: true }).extend({ gender: z.string().optional().transform((v) => (v ? v.toUpperCase() : "MALE")), branch: z.string().optional().nullable(), costCenter: z.string().optional().nullable() }),
  prepare: async (s) => {
    const m = new Map<string, unknown>();
    (await prisma.branch.findMany({ where: { companyId: s.companyId } })).forEach((b) => m.set(`b:${b.code}`, b.id));
    (await prisma.costCenter.findMany({ where: { companyId: s.companyId } })).forEach((c) => m.set(`cc:${c.code}`, c.id));
    return m;
  },
  upsert: async (s, row, ctx) => {
    const { branch, costCenter, ...r } = row as Record<string, unknown> & { branch?: string | null; costCenter?: string | null };
    const branchId = branch ? (ctx.get(`b:${branch}`) as string | undefined) : undefined;
    if (branch && !branchId) throw new Error(`Unknown branch ${branch}`);
    const costCenterId = costCenter ? (ctx.get(`cc:${costCenter}`) as string | undefined) : undefined;
    if (costCenter && !costCenterId) throw new Error(`Unknown cost center ${costCenter}`);
    const data = employeeSchema.parse({ ...r, branchId: branchId ?? null, costCenterId: costCenterId ?? null });
    const code = data.code || (await allocateNumber(s.companyId, "EMPLOYEE"));
    const { id: _id, ...rest } = data;
    void _id;
    await prisma.employee.upsert({ where: { companyId_code: { companyId: s.companyId, code } }, create: { ...rest, code, isSaudi: rest.nationality === "SA", companyId: s.companyId, createdById: s.userId }, update: { ...rest, code, isSaudi: rest.nationality === "SA", updatedById: s.userId } });
  },
};

export const accountsImport: ImportDefinition = {
  entity: "accounts",
  permission: "foundation.account:create",
  columns: [
    bil("code", "الرمز", "Code", true, "1101"),
    bil("nameAr", "الاسم (عربي)", "Name (Arabic)", true, "النقدية"),
    bil("nameEn", "الاسم (إنجليزي)", "Name (English)", true, "Cash"),
    bil("type", "النوع", "Type (ASSET/LIABILITY/EQUITY/REVENUE/EXPENSE)", true, "ASSET"),
    bil("parentCode", "رمز الحساب الأب", "Parent code", false, "1100"),
    bil("isPostable", "قابل للترحيل", "Postable (TRUE/FALSE)", false, "TRUE"),
  ],
  rowSchema: z.object({ code: z.coerce.string().min(1), nameAr: z.string().min(1), nameEn: z.string().min(1), type: z.string().transform((v) => v.toUpperCase()).pipe(z.enum(["ASSET", "LIABILITY", "EQUITY", "REVENUE", "EXPENSE"])), parentCode: z.coerce.string().optional().nullable(), isPostable: z.union([z.boolean(), z.string()]).optional().transform((v) => (v === undefined || v === null || v === "" ? true : String(v).toUpperCase() !== "FALSE")) }),
  upsert: async (s, row) => {
    const r = row as { code: string; nameAr: string; nameEn: string; type: "ASSET" | "LIABILITY" | "EQUITY" | "REVENUE" | "EXPENSE"; parentCode?: string | null; isPostable: boolean };
    let parentId: string | null = null;
    let level = 1;
    if (r.parentCode) {
      const parent = await prisma.account.findFirst({ where: { companyId: s.companyId, code: r.parentCode } });
      if (!parent) throw new Error(`Unknown parent ${r.parentCode}`);
      parentId = parent.id;
      level = parent.level + 1;
      if (parent.isPostable) await prisma.account.update({ where: { id: parent.id }, data: { isPostable: false } });
    }
    await prisma.account.upsert({
      where: { companyId_code: { companyId: s.companyId, code: r.code } },
      create: { companyId: s.companyId, code: r.code, nameAr: r.nameAr, nameEn: r.nameEn, type: r.type, parentId, level, isPostable: r.isPostable, createdById: s.userId },
      update: { nameAr: r.nameAr, nameEn: r.nameEn, type: r.type, parentId, level, isPostable: r.isPostable, updatedById: s.userId },
    });
  },
};

/** Opening balances: validated here; posting is delegated to finance module once built. */
export const openingBalancesImport: ImportDefinition = {
  entity: "opening-balances",
  permission: "finance.journal:create",
  columns: [
    bil("accountCode", "رمز الحساب", "Account code", true, "1101"),
    bil("costCenterCode", "مركز التكلفة", "Cost center code"),
    bil("debit", "مدين", "Debit", false, "10000"),
    bil("credit", "دائن", "Credit", false, "0"),
    bil("description", "البيان", "Description", false, "Opening balance"),
  ],
  rowSchema: z.object({ accountCode: z.coerce.string().min(1), costCenterCode: z.coerce.string().optional().nullable(), debit: z.coerce.number().min(0).default(0), credit: z.coerce.number().min(0).default(0), description: z.string().optional().nullable() }),
  prepare: async () => new Map<string, unknown>([["lines", []]]),
  upsert: async (s, row, ctx) => {
    const r = row as { accountCode: string; costCenterCode?: string | null; debit: number; credit: number; description?: string | null };
    const acc = await prisma.account.findFirst({ where: { companyId: s.companyId, code: r.accountCode, isPostable: true } });
    if (!acc) throw new Error(`Unknown or non-postable account ${r.accountCode}`);
    let costCenterId: string | null = null;
    if (r.costCenterCode) {
      const cc = await prisma.costCenter.findFirst({ where: { companyId: s.companyId, code: r.costCenterCode } });
      if (!cc) throw new Error(`Unknown cost center ${r.costCenterCode}`);
      costCenterId = cc.id;
    }
    (ctx.get("lines") as unknown[]).push({ accountId: acc.id, costCenterId, debit: r.debit, credit: r.credit, description: r.description ?? null });
  },
};

export const IMPORTS: Record<string, ImportDefinition> = {
  customers: customersImport,
  vendors: vendorsImport,
  items: itemsImport,
  employees: employeesImport,
  accounts: accountsImport,
  "opening-balances": openingBalancesImport,
};
