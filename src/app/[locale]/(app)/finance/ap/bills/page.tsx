import { financePage, type SP } from "@/modules/finance/_shared/page-helpers";
import { listBills, billColumns } from "@/modules/finance/ap/bills";
import { financeLookups } from "@/modules/finance/_shared/lookups";
import { enumOptions } from "@/modules/foundation/_shared/lookups";
import { PageHeader } from "@/components/shell/page-header";
import { DataTable } from "@/components/data-table/data-table";
import { plain } from "@/components/data-table/types";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { Plus } from "lucide-react";

export default async function BillsPage({ searchParams }: { searchParams: SP }) {
  const { session, locale, params, t, tf, te, perms } = await financePage("bill", searchParams);
  const [data, lk] = await Promise.all([listBills(session, params), financeLookups(session.companyId, locale)]);
  return (
    <>
      <PageHeader title={t("bills.title")} actions={perms.create && <Button asChild><Link href="/finance/ap/bills/new"><Plus /> {t("bills.new")}</Link></Button>} />
      <DataTable tableKey="bills" columns={billColumns(tf, t)} data={plain(data)} exportResource="bills" rowHrefTemplate="/finance/ap/bills/{id}"
        filters={[
          { key: "status", label: tf("status"), type: "select", options: enumOptions(te, "DocStatus", ["DRAFT", "PENDING_APPROVAL", "POSTED", "PARTIALLY_PAID", "PAID", "CANCELLED", "REVERSED"]) },
          { key: "vendorId", label: t("vendor"), type: "select", options: lk.vendors },
          { key: "overdue", label: t("overdue"), type: "boolean" },
          { key: "from", label: tf("from"), type: "date" },
          { key: "to", label: tf("to"), type: "date" },
        ]} />
    </>
  );
}
