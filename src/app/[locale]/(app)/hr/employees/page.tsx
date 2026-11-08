import { hrPage, type SP } from "@/modules/hr/page-helpers";
import { employees, employeeColumns } from "@/modules/foundation/employees/service";
import { financeLookups } from "@/modules/finance/_shared/lookups";
import { enumOptions } from "@/modules/foundation/_shared/lookups";
import { PageHeader } from "@/components/shell/page-header";
import { DataTable } from "@/components/data-table/data-table";
import { plain } from "@/components/data-table/types";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

export default async function HrEmployeesPage({ searchParams }: { searchParams: SP }) {
  const { session, locale, params, t, tf, te } = await hrPage("employee", searchParams);
  const [data, lk] = await Promise.all([employees.list(session, params), financeLookups(session.companyId, locale)]);
  return (
    <>
      <PageHeader title={t("employees.title")} description={t("employees.hint")} actions={<Button variant="outline" asChild><Link href="/foundation/employees">{t("employees.masterData")}</Link></Button>} />
      <DataTable tableKey="hr-employees" columns={employeeColumns(tf, locale)} data={plain(data)} exportResource="employees" rowHrefTemplate="/hr/employees/{id}" filters={[
        { key: "status", label: tf("employeeStatus"), type: "select", options: enumOptions(te, "EmployeeStatus", ["ACTIVE", "ON_LEAVE", "SUSPENDED", "TERMINATED"]) },
        { key: "branchId", label: tf("branch"), type: "select", options: lk.branches },
        { key: "isSaudi", label: tf("isSaudi"), type: "select", options: [{ value: "true", label: t("reports.saudi") }, { value: "false", label: t("reports.nonSaudi") }] },
      ]} />
    </>
  );
}
