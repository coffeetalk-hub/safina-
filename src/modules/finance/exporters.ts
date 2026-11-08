import { getTranslations } from "next-intl/server";
import type { Exporter } from "@/core/export/registry";
import type { ColumnDef } from "@/components/data-table/types";
import { allJournals, journalColumns } from "./journals/service";
import { allInvoices, invoiceColumns, arAging } from "./ar/invoices";
import { allReceipts, receiptColumns } from "./ar/receipts";
import { allBills, billColumns, apAging } from "./ap/bills";
import { allPayments, paymentColumns } from "./ap/payments";
import { allAssets, assetColumns } from "./assets/service";
import { allVouchers, voucherColumns } from "./petty-cash/service";
import { trialBalance, profitLoss, balanceSheet, accountLedger } from "./reports/service";
import { reportFilter } from "./reports/helpers";

async function labels(locale: string) {
  const [tf, t] = await Promise.all([getTranslations({ locale, namespace: "fields" }), getTranslations({ locale, namespace: "finance" })]);
  return { tf: (k: string) => tf(k), t: (k: string) => t(k) };
}

const make = (permission: string, columns: (tf: (k: string) => string, t: (k: string) => string) => ColumnDef[], load: Exporter["load"], ar: string, en: string): Exporter => ({
  permission,
  columns: async (locale) => {
    const { tf, t } = await labels(locale);
    return columns(tf, t);
  },
  load,
  sheetName: (locale) => (locale === "ar" ? ar : en),
});

export const journals = make("finance.journal:view", journalColumns, (s, p) => allJournals(s, p), "قيود اليومية", "Journal entries");
export const invoices = make("finance.invoice:view", invoiceColumns, (s, p) => allInvoices(s, p), "فواتير المبيعات", "Customer invoices");
export const receipts = make("finance.receipt:view", receiptColumns, (s, p) => allReceipts(s, p), "سندات القبض", "Receipts");
export const bills = make("finance.bill:view", billColumns, (s, p) => allBills(s, p), "فواتير الموردين", "Vendor bills");
export const payments = make("finance.payment:view", paymentColumns, (s, p) => allPayments(s, p), "سندات الصرف", "Payments");

const agingColumns = (tf: (k: string) => string, t: (k: string) => string): ColumnDef[] => [
  { key: "code", label: tf("code") },
  { key: "name", label: tf("name"), bilingual: "name" },
  { key: "current", label: t("aging.current"), type: "money", align: "end" },
  { key: "d1_30", label: t("aging.d1_30"), type: "money", align: "end" },
  { key: "d31_60", label: t("aging.d31_60"), type: "money", align: "end" },
  { key: "d61_90", label: t("aging.d61_90"), type: "money", align: "end" },
  { key: "d90plus", label: t("aging.d90plus"), type: "money", align: "end" },
  { key: "total", label: t("aging.total"), type: "money", align: "end" },
];
export const arAgingExporter = make("finance.report:view", agingColumns, (s, p) => arAging(s, new Date(p.filters.asOf || new Date().toISOString().slice(0, 10)), p.filters.partyId), "أعمار ذمم العملاء", "AR aging");
export const apAgingExporter = make("finance.report:view", agingColumns, (s, p) => apAging(s, new Date(p.filters.asOf || new Date().toISOString().slice(0, 10)), p.filters.partyId), "أعمار ذمم الموردين", "AP aging");

export const assets = make("finance.asset:view", assetColumns, (s, p) => allAssets(s, p), "سجل الأصول الثابتة", "Fixed assets");
export const pettyCash = make("finance.pettyCash:view", voucherColumns, (s, p) => allVouchers(s, p), "سندات العهدة", "Petty cash vouchers");

export const trialBalanceExporter = make(
  "finance.report:view",
  (tf, t) => [
    { key: "code", label: tf("code") },
    { key: "name", label: tf("name"), bilingual: "name" },
    { key: "openingDebit", label: `${t("reports.opening")} ${t("debit")}`, type: "money", align: "end" },
    { key: "openingCredit", label: `${t("reports.opening")} ${t("credit")}`, type: "money", align: "end" },
    { key: "debit", label: t("debit"), type: "money", align: "end" },
    { key: "credit", label: t("credit"), type: "money", align: "end" },
    { key: "closingDebit", label: `${t("reports.closing")} ${t("debit")}`, type: "money", align: "end" },
    { key: "closingCredit", label: `${t("reports.closing")} ${t("credit")}`, type: "money", align: "end" },
  ],
  async (s, p) => (await trialBalance(s, reportFilter(p))).rows,
  "ميزان المراجعة",
  "Trial balance",
);
const stmtCols = (tf: (k: string) => string, t: (k: string) => string): ColumnDef[] => [
  { key: "section", label: t("reports.section") },
  { key: "code", label: tf("code") },
  { key: "name", label: tf("name"), bilingual: "name" },
  { key: "amount", label: tf("amount"), type: "money", align: "end" },
];
export const profitLossExporter = make("finance.report:view", stmtCols, async (s, p) => {
  const r = await profitLoss(s, reportFilter(p));
  return [...r.revenue.lines.map((l) => ({ section: "Revenue", ...l })), { section: "Revenue", code: "", nameAr: "إجمالي الإيرادات", nameEn: "Total revenue", amount: r.revenue.total }, ...r.expenses.lines.map((l) => ({ section: "Expenses", ...l })), { section: "Expenses", code: "", nameAr: "إجمالي المصروفات", nameEn: "Total expenses", amount: r.expenses.total }, { section: "Net", code: "", nameAr: "صافي الربح", nameEn: "Net income", amount: r.netIncome }];
}, "قائمة الدخل", "Profit & loss");
export const balanceSheetExporter = make("finance.report:view", stmtCols, async (s, p) => {
  const r = await balanceSheet(s, reportFilter(p));
  return [...r.assets.lines.map((l) => ({ section: "Assets", ...l })), { section: "Assets", code: "", nameAr: "إجمالي الأصول", nameEn: "Total assets", amount: r.assets.total }, ...r.liabilities.lines.map((l) => ({ section: "Liabilities", ...l })), ...r.equity.lines.map((l) => ({ section: "Equity", ...l })), { section: "Equity", code: "", nameAr: "أرباح الفترة", nameEn: "Current earnings", amount: r.earnings }, { section: "Total", code: "", nameAr: "إجمالي الخصوم وحقوق الملكية", nameEn: "Total liabilities & equity", amount: r.totalLiabilitiesEquity }];
}, "قائمة المركز المالي", "Balance sheet");
export const ledgerExporter = make(
  "finance.report:view",
  (tf, t) => [
    { key: "date", label: tf("date"), type: "date" },
    { key: "number", label: tf("number") },
    { key: "description", label: tf("description") },
    { key: "costCenter", label: tf("costCenter") },
    { key: "debit", label: t("debit"), type: "money", align: "end" },
    { key: "credit", label: t("credit"), type: "money", align: "end" },
    { key: "balance", label: t("balance"), type: "money", align: "end" },
  ],
  async (s, p) => (p.filters.accountId ? (await accountLedger(s, p.filters.accountId, reportFilter(p))).rows : []),
  "دفتر الأستاذ",
  "General ledger",
);
