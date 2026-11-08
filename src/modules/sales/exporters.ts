import { getTranslations } from "next-intl/server";
import type { Exporter } from "@/core/export/registry";
import type { ColumnDef } from "@/components/data-table/types";
import { leads, leadColumns } from "./crm";
import { allQuotations, quotationColumns, allOrders, orderColumns } from "./quotations";
import { salesByCustomer, salesBySalesperson, salesByItem, salesByPeriod } from "./reports";
import { reportFilter } from "@/modules/finance/reports/helpers";

const make = (permission: string, columns: (tf: (k: string) => string, t: (k: string) => string, tfin: (k: string) => string) => ColumnDef[], load: Exporter["load"], ar: string, en: string): Exporter => ({
  permission,
  columns: async (locale) => {
    const [tf, t, tfin] = await Promise.all([getTranslations({ locale, namespace: "fields" }), getTranslations({ locale, namespace: "sales" }), getTranslations({ locale, namespace: "finance" })]);
    return columns((k) => tf(k), (k) => t(k), (k) => tfin(k));
  },
  load,
  sheetName: (locale) => (locale === "ar" ? ar : en),
});
const f = (p: Parameters<Exporter["load"]>[1]) => ({ ...reportFilter(p), salespersonId: p.filters.salespersonId || null, customerId: p.filters.customerId || null });

export const leadsExporter = make("sales.lead:view", (tf, t) => leadColumns(tf, t), (s, p) => leads.all(s, p), "العملاء المحتملون", "Leads");
export const quotations = make("sales.quotation:view", (tf, _t, tfin) => quotationColumns(tf, tfin), (s, p) => allQuotations(s, p), "عروض الأسعار", "Quotations");
export const salesOrders = make("sales.order:view", (tf, _t, tfin) => orderColumns(tf, tfin), (s, p) => allOrders(s, p), "أوامر البيع", "Sales orders");
export const byCustomer = make("sales.report:view", (tf, t) => [{ key: "code", label: tf("code") }, { key: "name", label: t("customer"), bilingual: "name" }, { key: "invoices", label: t("reports.invoices"), type: "number" }, { key: "net", label: t("reports.net"), type: "money" }, { key: "vat", label: t("reports.vat"), type: "money" }, { key: "total", label: t("reports.total"), type: "money" }, { key: "paid", label: t("reports.paid"), type: "money" }], (s, p) => salesByCustomer(s, f(p)), "المبيعات حسب العميل", "Sales by customer");
export const bySalesperson = make("sales.report:view", (tf, t) => [{ key: "code", label: tf("code") }, { key: "name", label: t("salesperson"), bilingual: "name" }, { key: "invoices", label: t("reports.invoices"), type: "number" }, { key: "net", label: t("reports.net"), type: "money" }, { key: "total", label: t("reports.total"), type: "money" }], (s, p) => salesBySalesperson(s, f(p)), "المبيعات حسب المندوب", "Sales by salesperson");
export const byItem = make("sales.report:view", (tf, t) => [{ key: "code", label: tf("code") }, { key: "name", label: t("item"), bilingual: "name" }, { key: "quantity", label: t("qty"), type: "number" }, { key: "net", label: t("reports.net"), type: "money" }, { key: "vat", label: t("reports.vat"), type: "money" }, { key: "total", label: t("reports.total"), type: "money" }], (s, p) => salesByItem(s, f(p)), "المبيعات حسب الصنف", "Sales by item");
export const byPeriod = make("sales.report:view", (tf, t) => [{ key: "period", label: tf("period") }, { key: "invoices", label: t("reports.invoices"), type: "number" }, { key: "net", label: t("reports.net"), type: "money" }, { key: "vat", label: t("reports.vat"), type: "money" }, { key: "total", label: t("reports.total"), type: "money" }], (s, p) => salesByPeriod(s, f(p)), "المبيعات حسب الفترة", "Sales by period");
