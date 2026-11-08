import { financePage, type SP } from "@/modules/finance/_shared/page-helpers";
import { apAging } from "@/modules/finance/ap/bills";
import { financeLookups } from "@/modules/finance/_shared/lookups";
import { PageHeader } from "@/components/shell/page-header";
import { AgingTable } from "@/components/finance/aging-table";

export default async function ApAgingPage({ searchParams }: { searchParams: SP }) {
  const { session, locale, params, t } = await financePage("report", searchParams);
  const asOf = params.filters.asOf || new Date().toISOString().slice(0, 10);
  const [rows, lk] = await Promise.all([apAging(session, new Date(asOf), params.filters.partyId), financeLookups(session.companyId, locale)]);
  return (
    <>
      <PageHeader title={t("apAging.title")} />
      <AgingTable rows={rows as never} asOf={asOf} parties={lk.vendors} partyId={params.filters.partyId ?? ""} resource="ap-aging" partyLabel={t("vendor")} />
    </>
  );
}
