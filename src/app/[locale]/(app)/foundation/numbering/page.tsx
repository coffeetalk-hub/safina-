import { listPage, type SP } from "@/modules/foundation/_shared/page-helpers";
import { listSequences } from "@/modules/foundation/numbering/service";
import { saveSequenceAction } from "@/modules/foundation/numbering/actions";
import { PageHeader } from "@/components/shell/page-header";
import { CrudList } from "@/components/forms/crud-list";
import { enumOptions } from "@/modules/foundation/_shared/lookups";

export default async function NumberingPage({ searchParams }: { searchParams: SP }) {
  const { session, t, tf, te, perms } = await listPage("numbering", searchParams);
  const rows = await listSequences(session);
  return (
    <>
      <PageHeader title={t("numbering.title")} description={t("numbering.patternHint")} />
      <CrudList
        tableKey="numbering"
        columns={[
          { key: "docType", label: tf("docType") },
          { key: "prefix", label: tf("prefix") },
          { key: "pattern", label: tf("pattern") },
          { key: "resetPolicy", label: tf("resetPolicy"), type: "enum", enumName: "SequenceReset" },
          { key: "nextNumber", label: tf("nextNumber"), type: "number", align: "end" },
          { key: "preview", label: t("numbering.preview") },
          { key: "configured", label: tf("status"), type: "boolean", align: "center" },
        ]}
        data={{ rows, total: rows.length, page: 1, pageSize: 100 }}
        fields={[
          { name: "docType", label: tf("docType"), disabled: true, dir: "ltr" },
          { name: "prefix", label: tf("prefix"), required: true, dir: "ltr" },
          { name: "pattern", label: tf("pattern"), required: true, dir: "ltr", colSpan: 2, description: t("numbering.patternHint") },
          { name: "resetPolicy", label: tf("resetPolicy"), type: "select", required: true, options: enumOptions(te, "SequenceReset", ["NEVER", "YEARLY", "MONTHLY"]) },
          { name: "nextNumber", label: tf("nextNumber"), type: "number", required: true },
        ]}
        titleNew={t("numbering.edit")}
        titleEdit={t("numbering.edit")}
        newDefaults={{}}
        saveAction={saveSequenceAction}
        can={{ create: false, edit: perms.edit, delete: false }}
        dialogSize="md"
      />
    </>
  );
}
