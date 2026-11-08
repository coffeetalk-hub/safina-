import { financePage, type SP } from "@/modules/finance/_shared/page-helpers";
import { listBudgets } from "@/modules/finance/budgets/service";
import { PageHeader } from "@/components/shell/page-header";
import { DataTable } from "@/components/data-table/data-table";
import { plain } from "@/components/data-table/types";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { Plus } from "lucide-react";

export default async function BudgetsPage({ searchParams }: { searchParams: SP }) {
  const { session, t, tf, perms } = await financePage("budget", searchParams);
  const rows = await listBudgets(session);
  return (
    <>
      <PageHeader title={t("budgets.title")} actions={perms.create && <Button asChild><Link href="/finance/budgets/new"><Plus /> {t("budgets.new")}</Link></Button>} />
      <DataTable
        tableKey="budgets"
        columns={[
          { key: "name", label: tf("name"), bilingual: "name", type: "link", hrefTemplate: "/finance/budgets/{id}" },
          { key: "year", label: t("fiscalYear") },
          { key: "lineCount", label: t("lines"), type: "number", align: "center" },
          { key: "total", label: t("total"), type: "money", align: "end" },
          { key: "status", label: tf("status"), type: "enum", enumName: "DocStatus", tones: { DRAFT: "secondary", APPROVED: "success" } },
          { key: "updatedAt", label: tf("updatedAt"), type: "datetime" },
        ]}
        data={plain({ rows, total: rows.length, page: 1, pageSize: 100 })}
        rowHrefTemplate="/finance/budgets/{id}"
      />
    </>
  );
}
