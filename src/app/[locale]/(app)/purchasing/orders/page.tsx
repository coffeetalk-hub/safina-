import { purchasingPage, type SP } from "@/modules/purchasing/page-helpers";
import { financeLookups } from "@/modules/finance/_shared/lookups";
import { listPurchaseOrders, poColumns } from "@/modules/purchasing/orders";
import { enumOptions } from "@/modules/foundation/_shared/lookups";
import { PageHeader } from "@/components/shell/page-header";
import { DataTable } from "@/components/data-table/data-table";
import { plain } from "@/components/data-table/types";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { Plus } from "lucide-react";

export default async function PurchaseOrdersPage({ searchParams }: { searchParams: SP }) {
  const { session, locale, params, t, tf, te, perms } = await purchasingPage("order", searchParams);
  const [data, lk] = await Promise.all([listPurchaseOrders(session, params), financeLookups(session.companyId, locale)]);
  return (
    <>
      <PageHeader title={t("orders.title")} actions={perms.create && <Button asChild><Link href="/purchasing/orders/new"><Plus /> {t("orders.new")}</Link></Button>} />
      <DataTable tableKey="purchase-orders" columns={poColumns(tf, t)} data={plain(data)} exportResource="purchase-orders" rowHrefTemplate="/purchasing/orders/{id}" filters={[
        { key: "status", label: tf("status"), type: "select", options: enumOptions(te, "PoStatus", ["DRAFT", "PENDING_APPROVAL", "APPROVED", "SENT", "PARTIALLY_BILLED", "BILLED", "CANCELLED"]) },
        { key: "vendorId", label: t("vendor"), type: "select", options: lk.vendors },
        { key: "from", label: tf("from"), type: "date" }, { key: "to", label: tf("to"), type: "date" },
      ]} />
    </>
  );
}
