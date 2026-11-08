import { financePage, type SP } from "@/modules/finance/_shared/page-helpers";
import { listInvoices, invoiceColumns } from "@/modules/finance/ar/invoices";
import { financeLookups } from "@/modules/finance/_shared/lookups";
import { enumOptions } from "@/modules/foundation/_shared/lookups";
import { PageHeader } from "@/components/shell/page-header";
import { DataTable } from "@/components/data-table/data-table";
import { plain } from "@/components/data-table/types";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { Plus } from "lucide-react";

export default async function InvoicesPage({ searchParams }: { searchParams: SP }) {
  const { session, locale, params, t, tf, te, perms } = await financePage("invoice", searchParams);
  const [data, lk] = await Promise.all([listInvoices(session, params), financeLookups(session.companyId, locale)]);
  return (
    <>
      <PageHeader title={t("invoices.title")} actions={perms.create && <Button asChild><Link href="/finance/ar/invoices/new"><Plus /> {t("invoices.new")}</Link></Button>} />
      <DataTable
        tableKey="invoices"
        columns={invoiceColumns(tf, t)}
        data={plain(data)}
        exportResource="invoices"
        rowHrefTemplate="/finance/ar/invoices/{id}"
        filters={[
          { key: "status", label: tf("status"), type: "select", options: enumOptions(te, "DocStatus", ["DRAFT", "PENDING_APPROVAL", "POSTED", "PARTIALLY_PAID", "PAID", "CANCELLED", "REVERSED"]) },
          { key: "customerId", label: t("customer"), type: "select", options: lk.customers },
          { key: "kind", label: tf("type"), type: "select", options: enumOptions(te, "InvoiceKind", ["INVOICE", "CREDIT_NOTE", "DEBIT_NOTE"]) },
          { key: "overdue", label: t("overdue"), type: "boolean" },
          { key: "from", label: tf("from"), type: "date" },
          { key: "to", label: tf("to"), type: "date" },
        ]}
      />
    </>
  );
}
