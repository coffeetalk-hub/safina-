import { salesPage, type SP } from "@/modules/sales/page-helpers";
import { financeLookups } from "@/modules/finance/_shared/lookups";
import { pipeline } from "@/modules/sales/crm";
import { PageHeader } from "@/components/shell/page-header";
import { plain } from "@/components/data-table/types";
import { Kanban } from "./kanban";

export default async function PipelinePage({ searchParams }: { searchParams: SP }) {
  const { session, locale, params, t, perms } = await salesPage("opportunity", searchParams);
  const [p, lk] = await Promise.all([pipeline(session, params.filters.ownerId), financeLookups(session.companyId, locale)]);
  return (
    <>
      <PageHeader title={t("pipeline.title")} />
      <Kanban stages={plain(p.stages)} opportunities={plain(p.opportunities)} customers={lk.customers} salespersons={lk.salespersons} branches={lk.branches} currencies={lk.currencies} ownerId={params.filters.ownerId ?? ""} can={perms} />
    </>
  );
}
