import { financePage, type SP } from "@/modules/finance/_shared/page-helpers";
import { listJournals, journalColumns } from "@/modules/finance/journals/service";
import { financeLookups } from "@/modules/finance/_shared/lookups";
import { enumOptions } from "@/modules/foundation/_shared/lookups";
import { PageHeader } from "@/components/shell/page-header";
import { DataTable } from "@/components/data-table/data-table";
import { plain } from "@/components/data-table/types";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { Plus } from "lucide-react";

export default async function JournalsPage({ searchParams }: { searchParams: SP }) {
  const { session, locale, params, t, tf, te, perms } = await financePage("journal", searchParams);
  const [data, lk] = await Promise.all([listJournals(session, params), financeLookups(session.companyId, locale)]);
  return (
    <>
      <PageHeader
        title={t("journals.title")}
        actions={
          perms.create && (
            <Button asChild>
              <Link href="/finance/journals/new">
                <Plus /> {t("journals.new")}
              </Link>
            </Button>
          )
        }
      />
      <DataTable
        tableKey="journals"
        columns={journalColumns(tf, t)}
        data={plain(data)}
        exportResource="journals"
        rowHrefTemplate="/finance/journals/{id}"
        filters={[
          { key: "status", label: tf("status"), type: "select", options: enumOptions(te, "DocStatus", ["DRAFT", "PENDING_APPROVAL", "APPROVED", "POSTED", "REVERSED"]) },
          { key: "source", label: t("source"), type: "select", options: enumOptions(te, "JournalSource", ["MANUAL", "RECURRING", "OPENING", "AR_INVOICE", "AR_RECEIPT", "AP_BILL", "AP_PAYMENT", "BANK", "PETTY_CASH", "ASSET", "PAYROLL"]) },
          { key: "branchId", label: tf("branch"), type: "select", options: lk.branches },
          { key: "from", label: tf("from"), type: "date" },
          { key: "to", label: tf("to"), type: "date" },
        ]}
      />
    </>
  );
}
