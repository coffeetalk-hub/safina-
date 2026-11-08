import { hrPage, type SP } from "@/modules/hr/page-helpers";
import { listEosb, eosColumns } from "@/modules/hr/eosb";
import { enumOptions } from "@/modules/foundation/_shared/lookups";
import { PageHeader } from "@/components/shell/page-header";
import { DataTable } from "@/components/data-table/data-table";
import { plain } from "@/components/data-table/types";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { Plus } from "lucide-react";

export default async function EosbListPage({ searchParams }: { searchParams: SP }) {
  const { session, params, t, tf, te, perms } = await hrPage("eosb", searchParams);
  const data = await listEosb(session, params);
  return (
    <>
      <PageHeader title={t("eos.title")} description={t("eos.hint")} actions={perms.create && <Button asChild><Link href="/hr/eosb/new"><Plus /> {t("eos.new")}</Link></Button>} />
      <DataTable tableKey="hr-eosb" columns={eosColumns(tf, t)} data={plain(data)} exportResource="hr-eosb" rowHrefTemplate="/hr/eosb/{id}" filters={[{ key: "status", label: tf("status"), type: "select", options: enumOptions(te, "EosStatus", ["DRAFT", "APPROVED", "POSTED", "PAID", "CANCELLED"]) }]} />
    </>
  );
}
