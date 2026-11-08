import { purchasingPage, type SP } from "@/modules/purchasing/page-helpers";
import { financeLookups } from "@/modules/finance/_shared/lookups";
import { listRequests, requestColumns } from "@/modules/purchasing/requests";
import { enumOptions } from "@/modules/foundation/_shared/lookups";
import { PageHeader } from "@/components/shell/page-header";
import { DataTable } from "@/components/data-table/data-table";
import { plain } from "@/components/data-table/types";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { Plus } from "lucide-react";

export default async function RequestsPage({ searchParams }: { searchParams: SP }) {
  const { session, locale, params, t, tf, te, perms } = await purchasingPage("request", searchParams);
  const [data, lk] = await Promise.all([listRequests(session, params), financeLookups(session.companyId, locale)]);
  return (
    <>
      <PageHeader title={t("requests.title")} description={t("requests.hint")} actions={perms.create && <Button asChild><Link href="/purchasing/requests/new"><Plus /> {t("requests.new")}</Link></Button>} />
      <DataTable tableKey="purchase-requests" columns={requestColumns(tf, t)} data={plain(data)} exportResource="purchase-requests" rowHrefTemplate="/purchasing/requests/{id}" filters={[
        { key: "status", label: tf("status"), type: "select", options: enumOptions(te, "PrStatus", ["DRAFT", "PENDING_APPROVAL", "APPROVED", "REJECTED", "RFQ", "ORDERED", "CANCELLED"]) },
        { key: "priority", label: t("priority"), type: "select", options: enumOptions(te, "Priority", ["LOW", "NORMAL", "HIGH", "URGENT"]) },
        { key: "requesterId", label: t("requester"), type: "select", options: lk.employees },
        { key: "from", label: tf("from"), type: "date" }, { key: "to", label: tf("to"), type: "date" },
      ]} />
    </>
  );
}
