import { hrPage, type SP } from "@/modules/hr/page-helpers";
import { financeLookups } from "@/modules/finance/_shared/lookups";
import { documents, documentColumns, withEmployee, withDaysLeft, HR_DOC_TYPES } from "@/modules/hr/employees";
import { saveDocumentAction, removeDocumentAction } from "@/modules/hr/actions";
import { enumOptions } from "@/modules/foundation/_shared/lookups";
import { PageHeader } from "@/components/shell/page-header";
import { CrudList } from "@/components/forms/crud-list";
import { plain } from "@/components/data-table/types";

export default async function DocumentsPage({ searchParams }: { searchParams: SP }) {
  const { session, locale, params, t, tf, te, tc, perms } = await hrPage("document", searchParams);
  const [data, lk] = await Promise.all([documents.list(session, params), financeLookups(session.companyId, locale)]);
  const rows = await withEmployee(session.companyId, withDaysLeft(data.rows as { employeeId: string; expiryDate: Date | null }[]));
  const expiring = rows.filter((r) => r.daysLeft != null && r.daysLeft <= 30).length;
  return (
    <>
      <PageHeader title={t("documents.title")} description={expiring ? t("documents.expiringHint", { n: expiring }) : t("documents.hint")} />
      <CrudList tableKey="hr-documents" columns={documentColumns(tf, t)} data={plain({ ...data, rows })} exportResource="hr-documents" dialogSize="lg" dateFields={["issueDate", "expiryDate"]}
        filters={[
          { key: "employeeId", label: t("employee"), type: "select", options: lk.employees },
          { key: "type", label: tf("type"), type: "select", options: enumOptions(te, "HrDocumentType", [...HR_DOC_TYPES]) },
          { key: "expiring", label: t("documents.expiring"), type: "select", options: [{ value: "true", label: tc("yes") }] },
        ]}
        titleNew={t("documents.new")} titleEdit={t("documents.edit")}
        newDefaults={{ employeeId: "", type: "IQAMA", number: "", issueDate: "", expiryDate: "", alertDays: 30, notes: "" }}
        fields={[
          { name: "employeeId", label: t("employee"), type: "select", options: lk.employees, required: true, colSpan: 2 },
          { name: "type", label: tf("type"), type: "select", options: enumOptions(te, "HrDocumentType", [...HR_DOC_TYPES]), required: true }, { name: "number", label: tf("number"), dir: "ltr" },
          { name: "issueDate", label: t("issueDate"), type: "date" }, { name: "expiryDate", label: t("expiryDate"), type: "date" },
          { name: "alertDays", label: t("alertDays"), type: "number", description: t("documents.alertHint") }, { name: "notes", label: tf("notes"), type: "textarea" },
        ]}
        saveAction={saveDocumentAction} removeAction={removeDocumentAction} can={perms} />
    </>
  );
}
