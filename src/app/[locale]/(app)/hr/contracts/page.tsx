import { hrPage, type SP } from "@/modules/hr/page-helpers";
import { financeLookups } from "@/modules/finance/_shared/lookups";
import { contracts, contractColumns, withEmployee } from "@/modules/hr/employees";
import { saveContractAction, removeContractAction } from "@/modules/hr/actions";
import { enumOptions } from "@/modules/foundation/_shared/lookups";
import { PageHeader } from "@/components/shell/page-header";
import { CrudList } from "@/components/forms/crud-list";
import { plain } from "@/components/data-table/types";

export default async function ContractsPage({ searchParams }: { searchParams: SP }) {
  const { session, locale, params, t, tf, te, tc, perms } = await hrPage("contract", searchParams);
  const [data, lk] = await Promise.all([contracts.list(session, params), financeLookups(session.companyId, locale)]);
  const rows = await withEmployee(session.companyId, data.rows as { employeeId: string }[]);
  return (
    <>
      <PageHeader title={t("contracts.title")} description={t("contracts.hint")} />
      <CrudList tableKey="hr-contracts" columns={contractColumns(tf, t)} data={plain({ ...data, rows })} exportResource="hr-contracts" dialogSize="lg" dateFields={["startDate", "endDate", "probationEndDate"]}
        filters={[
          { key: "employeeId", label: t("employee"), type: "select", options: lk.employees },
          { key: "type", label: tf("type"), type: "select", options: enumOptions(te, "ContractType", ["UNLIMITED", "LIMITED", "PART_TIME"]) },
          { key: "status", label: tf("status"), type: "select", options: enumOptions(te, "EmployeeContractStatus", ["ACTIVE", "ENDED", "TERMINATED"]) },
          { key: "expiring", label: t("contracts.expiring"), type: "select", options: [{ value: "true", label: tc("yes") }] },
        ]}
        titleNew={t("contracts.new")} titleEdit={t("contracts.edit")}
        newDefaults={{ employeeId: "", type: "UNLIMITED", status: "ACTIVE", startDate: new Date().toISOString().slice(0, 10), endDate: "", probationEndDate: "", number: "", workingHoursWeek: 48, noticeDays: 60, jobTitleAr: "", jobTitleEn: "", notes: "" }}
        fields={[
          { name: "employeeId", label: t("employee"), type: "select", options: lk.employees, required: true, colSpan: 2 },
          { name: "type", label: tf("type"), type: "select", options: enumOptions(te, "ContractType", ["UNLIMITED", "LIMITED", "PART_TIME"]), required: true },
          { name: "status", label: tf("status"), type: "select", options: enumOptions(te, "EmployeeContractStatus", ["ACTIVE", "ENDED", "TERMINATED"]), required: true },
          { name: "startDate", label: tf("startDate"), type: "date", required: true }, { name: "endDate", label: tf("endDate"), type: "date", description: t("contracts.endHint") },
          { name: "probationEndDate", label: t("probationEnd"), type: "date" }, { name: "number", label: tf("number"), dir: "ltr", description: t("contracts.numberHint") },
          { name: "workingHoursWeek", label: t("hoursPerWeek"), type: "number" }, { name: "noticeDays", label: t("noticeDays"), type: "number" },
          { name: "jobTitleAr", label: tf("jobTitleAr"), dir: "rtl" }, { name: "jobTitleEn", label: tf("jobTitleEn"), dir: "ltr" },
          { name: "notes", label: tf("notes"), type: "textarea", colSpan: 2 },
        ]}
        saveAction={saveContractAction} removeAction={removeContractAction} can={perms} />
    </>
  );
}
