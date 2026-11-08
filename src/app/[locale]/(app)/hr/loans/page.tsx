import { hrPage, type SP } from "@/modules/hr/page-helpers";
import { financeLookups } from "@/modules/finance/_shared/lookups";
import { listLoans, loanColumns } from "@/modules/hr/loans";
import { enumOptions } from "@/modules/foundation/_shared/lookups";
import { PageHeader } from "@/components/shell/page-header";
import { DataTable } from "@/components/data-table/data-table";
import { plain } from "@/components/data-table/types";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { Plus } from "lucide-react";

export default async function LoansPage({ searchParams }: { searchParams: SP }) {
  const { session, locale, params, t, tf, te, perms } = await hrPage("loan", searchParams);
  const [data, lk] = await Promise.all([listLoans(session, params), financeLookups(session.companyId, locale)]);
  return (
    <>
      <PageHeader title={t("loans.title")} description={t("loans.hint")} actions={perms.create && <Button asChild><Link href="/hr/loans/new"><Plus /> {t("loans.new")}</Link></Button>} />
      <DataTable tableKey="hr-loans" columns={loanColumns(tf, t)} data={plain(data)} exportResource="hr-loans" rowHrefTemplate="/hr/loans/{id}" filters={[
        { key: "status", label: tf("status"), type: "select", options: enumOptions(te, "LoanStatus", ["DRAFT", "PENDING_APPROVAL", "APPROVED", "ACTIVE", "PAID", "CANCELLED"]) },
        ...(perms.allEmployees ? [{ key: "employeeId", label: t("employee"), type: "select" as const, options: lk.employees }] : []),
      ]} />
    </>
  );
}
