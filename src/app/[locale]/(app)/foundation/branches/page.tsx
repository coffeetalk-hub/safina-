import { listPage, type SP } from "@/modules/foundation/_shared/page-helpers";
import { branches, branchColumns } from "@/modules/foundation/branches/service";
import { saveBranch, removeBranch } from "@/modules/foundation/branches/actions";
import { PageHeader } from "@/components/shell/page-header";
import { CrudList } from "@/components/forms/crud-list";
import { plain } from "@/components/data-table/types";

export default async function BranchesPage({ searchParams }: { searchParams: SP }) {
  const { session, params, t, tf, perms } = await listPage("branch", searchParams);
  const data = await branches.list(session, params);
  return (
    <>
      <PageHeader title={t("branches.title")} />
      <CrudList
        tableKey="branches"
        columns={branchColumns(tf)}
        data={plain(data)}
        exportResource="branches"
        fields={[
          { name: "code", label: tf("code"), required: true, dir: "ltr" },
          { name: "phone", label: tf("phone"), dir: "ltr" },
          { name: "nameAr", label: tf("nameAr"), required: true, dir: "rtl" },
          { name: "nameEn", label: tf("nameEn"), required: true, dir: "ltr" },
          { name: "addressAr", label: tf("addressAr"), dir: "rtl" },
          { name: "addressEn", label: tf("addressEn"), dir: "ltr" },
          { name: "isMain", label: tf("isMain"), type: "switch" },
          { name: "isActive", label: tf("isActive"), type: "switch" },
        ]}
        titleNew={t("branches.new")}
        titleEdit={t("branches.edit")}
        newDefaults={{ isMain: false, isActive: true }}
        saveAction={saveBranch}
        removeAction={removeBranch}
        can={perms}
        dialogSize="md"
      />
    </>
  );
}
