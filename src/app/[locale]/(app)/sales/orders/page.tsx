import { salesPage, type SP } from "@/modules/sales/page-helpers";
import { financeLookups } from "@/modules/finance/_shared/lookups";
import { listOrders, orderColumns } from "@/modules/sales/quotations";
import { enumOptions } from "@/modules/foundation/_shared/lookups";
import { PageHeader } from "@/components/shell/page-header";
import { DataTable } from "@/components/data-table/data-table";
import { plain } from "@/components/data-table/types";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { Plus } from "lucide-react";

export default async function OrdersPage({ searchParams }: { searchParams: SP }) {
  const { session, locale, params, t, tf, te, tfin, perms } = await salesPage("order", searchParams);
  const [data, lk] = await Promise.all([listOrders(session, params), financeLookups(session.companyId, locale)]);
  return (
    <>
      <PageHeader title={t("orders.title")} actions={perms.create && <Button asChild><Link href="/sales/orders/new"><Plus /> {t("orders.new")}</Link></Button>} />
      <DataTable tableKey="sales-orders" columns={orderColumns(tf, tfin)} data={plain(data)} exportResource="sales-orders" rowHrefTemplate="/sales/orders/{id}" filters={[
        { key: "status", label: tf("status"), type: "select", options: enumOptions(te, "OrderStatus", ["DRAFT", "CONFIRMED", "PARTIALLY_INVOICED", "INVOICED", "CANCELLED"]) },
        { key: "customerId", label: t("customer"), type: "select", options: lk.customers },
        { key: "salespersonId", label: t("salesperson"), type: "select", options: lk.salespersons },
        { key: "from", label: tf("from"), type: "date" }, { key: "to", label: tf("to"), type: "date" },
      ]} />
    </>
  );
}
