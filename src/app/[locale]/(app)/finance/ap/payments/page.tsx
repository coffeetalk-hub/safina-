import { financePage, type SP } from "@/modules/finance/_shared/page-helpers";
import { listPayments, paymentColumns } from "@/modules/finance/ap/payments";
import { financeLookups } from "@/modules/finance/_shared/lookups";
import { enumOptions } from "@/modules/foundation/_shared/lookups";
import { PageHeader } from "@/components/shell/page-header";
import { DataTable } from "@/components/data-table/data-table";
import { plain } from "@/components/data-table/types";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { Plus } from "lucide-react";

export default async function PaymentsPage({ searchParams }: { searchParams: SP }) {
  const { session, locale, params, t, tf, te, perms } = await financePage("payment", searchParams);
  const [data, lk] = await Promise.all([listPayments(session, params), financeLookups(session.companyId, locale)]);
  return (
    <>
      <PageHeader title={t("payments.title")} actions={perms.create && <Button asChild><Link href="/finance/ap/payments/new"><Plus /> {t("payments.new")}</Link></Button>} />
      <DataTable tableKey="payments" columns={paymentColumns(tf, t)} data={plain(data)} exportResource="payments" rowHrefTemplate="/finance/ap/payments/{id}"
        filters={[
          { key: "status", label: tf("status"), type: "select", options: enumOptions(te, "DocStatus", ["DRAFT", "PENDING_APPROVAL", "POSTED", "REVERSED"]) },
          { key: "vendorId", label: t("vendor"), type: "select", options: lk.vendors },
          { key: "from", label: tf("from"), type: "date" },
          { key: "to", label: tf("to"), type: "date" },
        ]} />
    </>
  );
}
