import type { PrismaClient } from "@prisma/client";
import { COA } from "./coa";

const CONTROL_ACCOUNT_MAPPINGS: Record<string, string> = {
  AR: "110301", AP: "210101", VAT_INPUT: "110501", VAT_OUTPUT: "210301", SALES_REVENUE: "410101", SALES_DISCOUNT: "410201", PURCHASE_EXPENSE: "510101",
  BANK_DEFAULT: "110201", CASH: "110101", PETTY_CASH: "110102", RETAINED_EARNINGS: "310201", FX_GAIN: "420201", FX_LOSS: "530201", ROUNDING: "530301",
  ACCUM_DEPRECIATION: "120201", DEPRECIATION_EXPENSE: "520301", FIXED_ASSETS: "120101", SALARIES_EXPENSE: "520101", SALARIES_PAYABLE: "210201",
  GOSI_EXPENSE: "520102", GOSI_PAYABLE: "210202", EOSB_EXPENSE: "520103", EOSB_PROVISION: "220101", EMPLOYEE_LOANS: "110401", OPENING_BALANCE: "310301",
  UNEARNED_REVENUE: "210401", ADVANCES_TO_VENDORS: "110402", ADVANCES_FROM_CUSTOMERS: "210402", VAT_PAYABLE: "210302", OTHER_INCOME: "420101", OTHER_EXPENSE: "530302",
};

/** Installs the Saudi SME chart of accounts and its control-account mappings. Idempotent. */
export async function installChartOfAccounts(prisma: PrismaClient, companyId: string) {
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
  for (const [key, code] of Object.entries(CONTROL_ACCOUNT_MAPPINGS)) {
    if (!accountIds[code]) continue;
    await prisma.accountMapping.upsert({ where: { companyId_key: { companyId, key } }, create: { companyId, key, accountId: accountIds[code] }, update: { accountId: accountIds[code] } });
  }
  return accountIds;
}
