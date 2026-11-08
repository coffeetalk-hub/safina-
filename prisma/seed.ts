/**
 * Demo seed: 2 companies, chart of accounts, 10 customers, 10 vendors, 15 employees,
 * cost centers, items, users with roles, approval policy, sample notifications.
 * Idempotent — safe to re-run. Run: npm run db:seed
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { bootstrapCompany } from "../src/modules/foundation/companies/service";
import { COA } from "./seed-data/coa";
import { CUSTOMERS, VENDORS, ITEMS, EMPLOYEES, COST_CENTERS } from "./seed-data/master";
import { ROLE_TEMPLATES } from "../src/core/rbac/permissions";
import type { Tx } from "../src/lib/prisma";
import { seedFinance } from "./seed-finance";
import { seedSales } from "./seed-sales";
import { seedPurchasing } from "./seed-purchasing";
import { seedHr } from "./seed-hr";

const prisma = new PrismaClient();
const PASSWORD = "Safina@2026";

async function main() {
  console.log("Seeding Safina ERP demo data…");
  const hash = await bcrypt.hash(PASSWORD, 10);

  // ── Users
  const users = [
    { email: "admin@thesailors.ai", nameAr: "مدير النظام", nameEn: "System Admin", isSuperAdmin: true, locale: "ar" },
    { email: "finance@thesailors.ai", nameAr: "سارة المالية", nameEn: "Sara Finance", isSuperAdmin: false, locale: "en" },
    { email: "sales@thesailors.ai", nameAr: "خالد المبيعات", nameEn: "Khalid Sales", isSuperAdmin: false, locale: "ar" },
    { email: "hr@thesailors.ai", nameAr: "نورة الموارد", nameEn: "Noura HR", isSuperAdmin: false, locale: "ar" },
    { email: "purchasing@thesailors.ai", nameAr: "فهد المشتريات", nameEn: "Fahad Purchasing", isSuperAdmin: false, locale: "en" },
    { email: "employee@thesailors.ai", nameAr: "موظف تجريبي", nameEn: "Demo Employee", isSuperAdmin: false, locale: "ar" },
  ];
  const userIds: Record<string, string> = {};
  for (const u of users) {
    const row = await prisma.user.upsert({ where: { email: u.email }, create: { ...u, passwordHash: hash }, update: { nameAr: u.nameAr, nameEn: u.nameEn, isSuperAdmin: u.isSuperAdmin, isActive: true, deletedAt: null } });
    userIds[u.email] = row.id;
  }

  // ── Companies
  const companies = [
    { code: "SAILORS", nameAr: "شركة البحّارة للتقنية", nameEn: "The Sailors Technology Co.", crNumber: "1010123456", vatNumber: "300012345600003", city: "Riyadh", addressAr: "طريق الملك فهد، الرياض", addressEn: "King Fahd Rd, Riyadh", phone: "+966112345678", email: "info@thesailors.ai" },
    { code: "HARBOR", nameAr: "شركة المرفأ للخدمات اللوجستية", nameEn: "Harbor Logistics Services Co.", crNumber: "2050987654", vatNumber: "300098765400003", city: "Jeddah", addressAr: "شارع الأمير سلطان، جدة", addressEn: "Prince Sultan St, Jeddah", phone: "+966126543210", email: "info@harbor.example" },
  ];
  const companyIds: string[] = [];
  for (const c of companies) {
    const row = await prisma.company.upsert({ where: { code: c.code }, create: c, update: c });
    companyIds.push(row.id);
    await prisma.$transaction((tx) => bootstrapCompany(tx as unknown as Tx, row.id, userIds["admin@thesailors.ai"]));
  }

  // ── Per-company data
  for (const [ci, companyId] of companyIds.entries()) {
    const roles = await prisma.role.findMany({ where: { companyId } });
    const roleId = (code: string) => roles.find((r) => r.code === code)!.id;
    const assign = async (email: string, codes: string[]) => {
      const uc = await prisma.userCompany.upsert({ where: { userId_companyId: { userId: userIds[email], companyId } }, create: { userId: userIds[email], companyId }, update: {} });
      for (const code of codes) await prisma.userCompanyRole.upsert({ where: { userCompanyId_roleId: { userCompanyId: uc.id, roleId: roleId(code) } }, create: { userCompanyId: uc.id, roleId: roleId(code) }, update: {} });
    };
    await assign("finance@thesailors.ai", ["FINANCE_MANAGER", "ACCOUNTANT"]);
    await assign("sales@thesailors.ai", ["SALES"]);
    await assign("hr@thesailors.ai", ["HR"]);
    await assign("purchasing@thesailors.ai", ["PURCHASING"]);
    await assign("employee@thesailors.ai", ["EMPLOYEE"]);
    void ROLE_TEMPLATES;

    // Chart of accounts (hierarchical)
    const accountIds: Record<string, string> = {};
    for (const a of COA) {
      const parentId = a.parent ? accountIds[a.parent] : null;
      const level = a.code.length <= 1 ? 1 : a.code.length <= 2 ? 2 : a.code.length <= 4 ? 3 : 4;
      const row = await prisma.account.upsert({
        where: { companyId_code: { companyId, code: a.code } },
        create: { companyId, code: a.code, nameAr: a.ar, nameEn: a.en, type: a.type, parentId, level, isPostable: a.postable ?? level >= 4, isControl: !!a.control },
        update: { nameAr: a.ar, nameEn: a.en, type: a.type, parentId, level, isPostable: a.postable ?? level >= 4, isControl: !!a.control },
      });
      accountIds[a.code] = row.id;
    }
    const mappings: Record<string, string> = {
      AR: "110301", AP: "210101", VAT_INPUT: "110501", VAT_OUTPUT: "210301", SALES_REVENUE: "410101", SALES_DISCOUNT: "410201", PURCHASE_EXPENSE: "510101",
      BANK_DEFAULT: "110201", CASH: "110101", PETTY_CASH: "110102", RETAINED_EARNINGS: "310201", FX_GAIN: "420201", FX_LOSS: "530201", ROUNDING: "530301",
      ACCUM_DEPRECIATION: "120201", DEPRECIATION_EXPENSE: "520301", FIXED_ASSETS: "120101", SALARIES_EXPENSE: "520101", SALARIES_PAYABLE: "210201",
      GOSI_EXPENSE: "520102", GOSI_PAYABLE: "210202", EOSB_EXPENSE: "520103", EOSB_PROVISION: "220101", EMPLOYEE_LOANS: "110401", OPENING_BALANCE: "310301",
      UNEARNED_REVENUE: "210401", ADVANCES_TO_VENDORS: "110402", ADVANCES_FROM_CUSTOMERS: "210402", VAT_PAYABLE: "210302", OTHER_INCOME: "420101", OTHER_EXPENSE: "530302",
    };
    for (const [key, code] of Object.entries(mappings)) {
      if (!accountIds[code]) continue;
      await prisma.accountMapping.upsert({ where: { companyId_key: { companyId, key } }, create: { companyId, key, accountId: accountIds[code] }, update: { accountId: accountIds[code] } });
    }

    // Cost centers
    const ccIds: Record<string, string> = {};
    for (const cc of COST_CENTERS) {
      const row = await prisma.costCenter.upsert({ where: { companyId_code: { companyId, code: cc.code } }, create: { companyId, code: cc.code, nameAr: cc.ar, nameEn: cc.en }, update: { nameAr: cc.ar, nameEn: cc.en } });
      ccIds[cc.code] = row.id;
    }

    // Branches
    const branches = ci === 0 ? [{ code: "RUH", ar: "فرع الرياض", en: "Riyadh branch" }, { code: "JED", ar: "فرع جدة", en: "Jeddah branch" }] : [{ code: "DMM", ar: "فرع الدمام", en: "Dammam branch" }];
    for (const b of branches) await prisma.branch.upsert({ where: { companyId_code: { companyId, code: b.code } }, create: { companyId, code: b.code, nameAr: b.ar, nameEn: b.en }, update: {} });
    const mainBranch = await prisma.branch.findFirstOrThrow({ where: { companyId, isMain: true } });

    // Tax codes lookup
    const vat15 = await prisma.taxCode.findFirstOrThrow({ where: { companyId, code: "VAT15" } });

    // Customers / vendors / items
    for (const [i, c] of CUSTOMERS.entries()) {
      await prisma.customer.upsert({
        where: { companyId_code: { companyId, code: `C-${String(i + 1).padStart(4, "0")}` } },
        create: { companyId, code: `C-${String(i + 1).padStart(4, "0")}`, ...c, receivableAccountId: accountIds["110301"], creditLimit: 50000 + i * 10000 },
        update: { ...c },
      });
    }
    for (const [i, v] of VENDORS.entries()) {
      await prisma.vendor.upsert({
        where: { companyId_code: { companyId, code: `V-${String(i + 1).padStart(4, "0")}` } },
        create: { companyId, code: `V-${String(i + 1).padStart(4, "0")}`, ...v, payableAccountId: accountIds["210101"] },
        update: { ...v },
      });
    }
    for (const it of ITEMS) {
      await prisma.item.upsert({
        where: { companyId_code: { companyId, code: it.code } },
        create: { companyId, ...it, taxCodeId: vat15.id, revenueAccountId: accountIds["410101"], expenseAccountId: accountIds["510101"] },
        update: { nameAr: it.nameAr, nameEn: it.nameEn, salePrice: it.salePrice, costPrice: it.costPrice },
      });
    }

    // Employees (15) — managers first
    const empIds: Record<string, string> = {};
    for (const [i, e] of EMPLOYEES.entries()) {
      const code = `EMP-${String(i + 1).padStart(4, "0")}`;
      const { costCenter, manager, hireDate, dob, ...fields } = e;
      const row = await prisma.employee.upsert({
        where: { companyId_code: { companyId, code } },
        create: { companyId, code, ...fields, isSaudi: e.nationality === "SA", branchId: mainBranch.id, costCenterId: ccIds[costCenter], managerId: manager ? empIds[manager] : null, hireDate: new Date(hireDate), dateOfBirth: new Date(dob) },
        update: { jobTitleAr: e.jobTitleAr, jobTitleEn: e.jobTitleEn, department: e.department, managerId: e.manager ? empIds[e.manager] : null },
      }).catch(async () => prisma.employee.findFirstOrThrow({ where: { companyId, code } }));
      empIds[code] = row.id;
    }
    // link demo employee user to EMP-0015
    if (ci === 0) await prisma.employee.update({ where: { id: empIds["EMP-0015"] }, data: { userId: userIds["employee@thesailors.ai"] } }).catch(() => undefined);

    // Approval policy: purchase orders > 10,000 need Finance Manager then Admin
    const existingPolicy = await prisma.approvalPolicy.findFirst({ where: { companyId, docType: "PURCHASE_ORDER" } });
    if (!existingPolicy) {
      await prisma.approvalPolicy.create({
        data: {
          companyId, docType: "PURCHASE_ORDER", nameAr: "أوامر الشراء فوق 10,000", nameEn: "Purchase orders above 10,000", minAmount: 10000,
          steps: { create: [{ order: 1, roleId: roleId("FINANCE_MANAGER"), nameAr: "اعتماد المدير المالي", nameEn: "Finance manager approval" }, { order: 2, roleId: roleId("ADMIN"), nameAr: "اعتماد الإدارة", nameEn: "Management approval" }] },
        },
      });
      await prisma.approvalPolicy.create({
        data: {
          companyId, docType: "LEAVE", nameAr: "طلبات الإجازة", nameEn: "Leave requests", minAmount: 0,
          steps: { create: [{ order: 1, roleId: roleId("HR"), nameAr: "اعتماد الموارد البشرية", nameEn: "HR approval" }] },
        },
      });
    }

    // Exchange rates
    for (const [code, ar, en, rate] of [["USD", "دولار أمريكي", "US Dollar", 3.75], ["EUR", "يورو", "Euro", 4.05], ["AED", "درهم إماراتي", "UAE Dirham", 1.02]] as const) {
      await prisma.currency.upsert({ where: { code }, create: { code, nameAr: ar, nameEn: en, decimals: 2 }, update: {} });
      await prisma.companyCurrency.upsert({ where: { companyId_currencyCode: { companyId, currencyCode: code } }, create: { companyId, currencyCode: code }, update: {} });
      const d = new Date(Date.UTC(new Date().getFullYear(), 0, 1));
      await prisma.exchangeRate.upsert({ where: { companyId_currencyCode_rateDate: { companyId, currencyCode: code, rateDate: d } }, create: { companyId, currencyCode: code, rateDate: d, rate }, update: { rate } });
    }

    // Settings
    const settings = { invoiceFooterAr: "شكرًا لتعاملكم معنا", invoiceFooterEn: "Thank you for your business", invoiceTermsAr: "السداد خلال 30 يومًا من تاريخ الفاتورة", invoiceTermsEn: "Payment due within 30 days of invoice date", showQr: true, primaryColor: "#1e3a5f", bankDetails: "Bank: Al Rajhi Bank — IBAN: SA00 0000 0000 0000 0000 0000", invoiceTemplate: "CLASSIC", defaultPaymentTermsDays: 30, emailNotifications: true };
    for (const [key, value] of Object.entries(settings)) await prisma.companySetting.upsert({ where: { companyId_key: { companyId, key } }, create: { companyId, key, value }, update: { value } });

    // Welcome notifications
    for (const email of Object.keys(userIds)) {
      const exists = await prisma.notification.findFirst({ where: { userId: userIds[email], type: "WELCOME", companyId } });
      if (!exists) await prisma.notification.create({ data: { companyId, userId: userIds[email], type: "WELCOME", titleAr: "مرحبًا بك في سفينة ERP", titleEn: "Welcome to Safina ERP", bodyAr: "تم تجهيز بيانات تجريبية لهذه الشركة.", bodyEn: "Demo data has been prepared for this company.", link: "/dashboard" } });
    }
  }

  // Finance demo transactions (first company only)
  await seedFinance(companyIds[0], userIds["admin@thesailors.ai"]);
  await seedSales(companyIds[0], userIds["admin@thesailors.ai"]);
  await seedPurchasing(companyIds[0], userIds["admin@thesailors.ai"]);
  await seedHr(companyIds[0], userIds["admin@thesailors.ai"]);

  console.log("Seed complete.");
  console.log("Logins (password for all: %s):", PASSWORD);
  users.forEach((u) => console.log("  -", u.email));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
