import { purchasingPage, type SP } from "@/modules/purchasing/page-helpers";
import { listRfqs, rfqColumns } from "@/modules/purchasing/rfq";
import { enumOptions } from "@/modules/foundation/_shared/lookups";
import { PageHeader } from "@/components/shell/page-header";
import { DataTable } from "@/components/data-table/data-table";
import { plain } from "@/components/data-table/types";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { Plus } from "lucide-react";

export default async function RfqListPage({ searchParams }: { searchParams: SP }) {
  const { session, params, t, tf, te, perms } = await purchasingPage("rfq", searchParams);
  const data = await listRfqs(session, params);
  return (
    <>
      <PageHeader title={t("rfq.title")} description={t("rfq.hint")} actions={perms.create && <Button asChild><Link href="/purchasing/rfq/new"><Plus /> {t("rfq.new")}</Link></Button>} />
      <DataTable tableKey="rfqs" columns={rfqColumns(tf, t)} data={plain(data)} exportResource="rfqs" rowHrefTemplate="/purchasing/rfq/{id}" filters={[
        { key: "status", label: tf("status"), type: "select", options: enumOptions(te, "RfqStatus", ["DRAFT", "SENT", "QUOTED", "AWARDED", "CANCELLED"]) },
      ]} />
    </>
  );
}
