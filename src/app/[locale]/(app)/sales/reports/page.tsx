import { salesPage, type SP } from "@/modules/sales/page-helpers";
import { financeLookups } from "@/modules/finance/_shared/lookups";
import { salesByCustomer, salesBySalesperson, salesByItem, salesByPeriod } from "@/modules/sales/reports";
import { reportFilter } from "@/modules/finance/reports/helpers";
import { PageHeader } from "@/components/shell/page-header";
import { SalesReportsClient } from "./client";

export default async function SalesReportsPage({ searchParams }: { searchParams: SP }) {
  const { session, locale, params, t } = await salesPage("report", searchParams);
  const f = { ...reportFilter(params), salespersonId: params.filters.salespersonId || null, customerId: params.filters.customerId || null };
  const [lk, byCustomer, bySalesperson, byItem, byPeriod] = await Promise.all([financeLookups(session.companyId, locale), salesByCustomer(session, f), salesBySalesperson(session, f), salesByItem(session, f), salesByPeriod(session, f)]);
  return (
    <>
      <PageHeader title={t("reports.title")} description={`${f.fromIso} → ${f.toIso}`} />
      <SalesReportsClient filters={{ from: f.fromIso, to: f.toIso, branchId: f.branchId ?? "", salespersonId: f.salespersonId ?? "", customerId: f.customerId ?? "" }} lookups={{ branches: lk.branches, salespersons: lk.salespersons, customers: lk.customers }} data={{ byCustomer, bySalesperson, byItem, byPeriod }} />
    </>
  );
}
