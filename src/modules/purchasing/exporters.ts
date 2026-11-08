import { getTranslations } from "next-intl/server";
import type { Exporter } from "@/core/export/registry";
import type { ColumnDef } from "@/components/data-table/types";
import { allRequests, requestColumns } from "./requests";
import { allRfqs, rfqColumns } from "./rfq";
import { allPurchaseOrders, poColumns } from "./orders";
import { contracts, contractColumns, withDaysLeft } from "./contracts";
import { evaluations, evaluationColumns } from "./evaluations";
import { purchasesByVendor, purchasesByItem, purchasesByPeriod, pendingPurchasingApprovals } from "./reports";
import { reportFilter } from "@/modules/finance/reports/helpers";

const make = (permission: string, columns: (tf: (k: string) => string, t: (k: string) => string) => ColumnDef[], load: Exporter["load"], ar: string, en: string): Exporter => ({
  permission,
  columns: async (locale) => {
    const [tf, t] = await Promise.all([getTranslations({ locale, namespace: "fields" }), getTranslations({ locale, namespace: "purchasing" })]);
    return columns((k) => tf(k), (k) => t(k));
  },
  load,
  sheetName: (locale) => (locale === "ar" ? ar : en),
});
const f = (p: Parameters<Exporter["load"]>[1]) => ({ ...reportFilter(p), vendorId: p.filters.vendorId || null });

export const requests = make("purchasing.request:view", requestColumns, (s, p) => allRequests(s, p), "طلبات الشراء", "Purchase requests");
export const rfqs = make("purchasing.rfq:view", rfqColumns, (s, p) => allRfqs(s, p), "طلبات عروض الأسعار", "RFQs");
export const purchaseOrders = make("purchasing.order:view", poColumns, (s, p) => allPurchaseOrders(s, p), "أوامر الشراء", "Purchase orders");
export const vendorContracts = make("purchasing.contract:view", contractColumns, async (s, p) => withDaysLeft(await contracts.all(s, p) as { endDate: Date }[]), "عقود الموردين", "Vendor contracts");
export const vendorEvaluations = make("purchasing.evaluation:view", evaluationColumns, (s, p) => evaluations.all(s, p), "تقييم الموردين", "Vendor evaluations");
export const byVendor = make("purchasing.report:view", (tf, t) => [{ key: "code", label: tf("code") }, { key: "name", label: t("vendor"), bilingual: "name" }, { key: "bills", label: t("reports.bills"), type: "number" }, { key: "net", label: t("reports.net"), type: "money" }, { key: "vat", label: t("reports.vat"), type: "money" }, { key: "total", label: t("reports.total"), type: "money" }, { key: "paid", label: t("reports.paid"), type: "money" }], (s, p) => purchasesByVendor(s, f(p)), "المشتريات حسب المورد", "Purchases by vendor");
export const byItem = make("purchasing.report:view", (tf, t) => [{ key: "code", label: tf("code") }, { key: "name", label: t("item"), bilingual: "name" }, { key: "quantity", label: t("qty"), type: "number" }, { key: "net", label: t("reports.net"), type: "money" }, { key: "total", label: t("reports.total"), type: "money" }], (s, p) => purchasesByItem(s, f(p)), "المشتريات حسب الصنف", "Purchases by item");
export const byPeriod = make("purchasing.report:view", (tf, t) => [{ key: "period", label: tf("period") }, { key: "bills", label: t("reports.bills"), type: "number" }, { key: "net", label: t("reports.net"), type: "money" }, { key: "vat", label: t("reports.vat"), type: "money" }, { key: "total", label: t("reports.total"), type: "money" }], (s, p) => purchasesByPeriod(s, f(p)), "المشتريات حسب الفترة", "Purchases by period");
export const pendingApprovals = make("purchasing.report:view", (tf, t) => [{ key: "docType", label: tf("docType") }, { key: "docNumber", label: tf("number") }, { key: "requester", label: tf("requestedBy"), bilingual: "requester" }, { key: "amount", label: tf("amount"), type: "money" }, { key: "step", label: tf("step") }, { key: "approver", label: tf("approver"), bilingual: "approver" }, { key: "ageDays", label: t("reports.ageDays"), type: "number" }], (s) => pendingPurchasingApprovals(s), "الموافقات المعلقة", "Pending approvals");
