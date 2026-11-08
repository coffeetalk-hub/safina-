import { salesPage, type SP } from "@/modules/sales/page-helpers";
import { financeLookups } from "@/modules/finance/_shared/lookups";
import { leads, leadColumns } from "@/modules/sales/crm";
import { PageHeader } from "@/components/shell/page-header";
import { plain } from "@/components/data-table/types";
import { enumOptions } from "@/modules/foundation/_shared/lookups";
import { LeadsClient } from "./client";

export default async function LeadsPage({ searchParams }: { searchParams: SP }) {
  const { session, locale, params, t, tf, te, perms } = await salesPage("lead", searchParams);
  const [data, lk] = await Promise.all([leads.list(session, params), financeLookups(session.companyId, locale)]);
  const statuses = enumOptions(te, "LeadStatus", ["NEW", "CONTACTED", "QUALIFIED", "CONVERTED", "LOST"]);
  return (
    <>
      <PageHeader title={t("leads.title")} />
      <LeadsClient data={plain(data)} columns={leadColumns(tf, t)} statuses={statuses} salespersons={lk.salespersons} branches={lk.branches} can={perms} canConvert={session.permissions.has("*") || session.permissions.has("sales.opportunity:create")} />
    </>
  );
}
