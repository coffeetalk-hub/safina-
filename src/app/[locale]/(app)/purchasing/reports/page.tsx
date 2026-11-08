import { purchasingPage, type SP } from "@/modules/purchasing/page-helpers";
import { financeLookups } from "@/modules/finance/_shared/lookups";
import { purchasesByVendor, purchasesByItem, purchasesByPeriod, pendingPurchasingApprovals } from "@/modules/purchasing/reports";
import { reportFilter } from "@/modules/finance/reports/helpers";
import { PageHeader } from "@/components/shell/page-header";
import { plain } from "@/components/data-table/types";
import { PurchasingReportsClient } from "./client";

export default async function PurchasingReportsPage({ searchParams }: { searchParams: SP }) {
  const { session, locale, params, t } = await purchasingPage("report", searchParams);
  const f = { ...reportFilter(params), vendorId: params.filters.vendorId || null };
  const [lk, byVendor, byItem, byPeriod, pending] = await Promise.all([financeLookups(session.companyId, locale), purchasesByVendor(session, f), purchasesByItem(session, f), purchasesByPeriod(session, f), pendingPurchasingApprovals(session)]);
  return (
    <>
      <PageHeader title={t("reports.title")} description={`${f.fromIso} → ${f.toIso}`} />
      <PurchasingReportsClient filters={{ from: f.fromIso, to: f.toIso, branchId: f.branchId ?? "", vendorId: f.vendorId ?? "" }} lookups={{ branches: lk.branches, vendors: lk.vendors }} data={{ byVendor, byItem, byPeriod, pending: plain(pending) }} />
    </>
  );
}
