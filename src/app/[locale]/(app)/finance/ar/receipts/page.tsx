import { financePage, type SP } from "@/modules/finance/_shared/page-helpers";
import { listReceipts, receiptColumns } from "@/modules/finance/ar/receipts";
import { financeLookups } from "@/modules/finance/_shared/lookups";
import { enumOptions } from "@/modules/foundation/_shared/lookups";
import { PageHeader } from "@/components/shell/page-header";
import { DataTable } from "@/components/data-table/data-table";
import { plain } from "@/components/data-table/types";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { Plus } from "lucide-react";

export default async function ReceiptsPage({ searchParams }: { searchParams: SP }) {
  const { session, locale, params, t, tf, te, perms } = await financePage("receipt", searchParams);
  const [data, lk] = await Promise.all([listReceipts(session, params), financeLookups(session.companyId, locale)]);
  return (
    <>
      <PageHeader title={t("receipts.title")} actions={perms.create && <Button asChild><Link href="/finance/ar/receipts/new"><Plus /> {t("receipts.new")}</Link></Button>} />
      <DataTable tableKey="receipts" columns={receiptColumns(tf, t)} data={plain(data)} exportResource="receipts" rowHrefTemplate="/finance/ar/receipts/{id}"
        filters={[
          { key: "status", label: tf("status"), type: "select", options: enumOptions(te, "DocStatus", ["DRAFT", "POSTED", "REVERSED"]) },
          { key: "customerId", label: t("customer"), type: "select", options: lk.customers },
          { key: "from", label: tf("from"), type: "date" },
          { key: "to", label: tf("to"), type: "date" },
        ]} />
    </>
  );
}
