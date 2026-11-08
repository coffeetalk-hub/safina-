import { listPage, type SP } from "@/modules/foundation/_shared/page-helpers";
import { lookups } from "@/modules/foundation/_shared/lookups";
import { costCenters, costCenterColumns } from "@/modules/foundation/cost-centers/service";
import { saveCostCenter, removeCostCenter } from "@/modules/foundation/cost-centers/actions";
import { PageHeader } from "@/components/shell/page-header";
import { CrudList } from "@/components/forms/crud-list";
import { plain } from "@/components/data-table/types";

export default async function CostCentersPage({ searchParams }: { searchParams: SP }) {
  const { session, locale, params, t, tf, perms } = await listPage("costCenter", searchParams);
  const [data, lk] = await Promise.all([costCenters.list(session, params), lookups(session.companyId, locale)]);

  return (
    <>
      <PageHeader title={t("costCenters.title")} />
      <CrudList
        tableKey="cost-centers"
        columns={costCenterColumns(tf)}
        data={plain(data)}
        exportResource="cost-centers"
        filters={[{ key: "isActive", label: tf("isActive"), type: "boolean" }]}
        fields={[
          { name: "code", label: tf("code"), required: true, dir: "ltr" },
          { name: "parentId", label: tf("parent"), type: "select", options: lk.costCenters },
          { name: "nameAr", label: tf("nameAr"), required: true, dir: "rtl" },
          { name: "nameEn", label: tf("nameEn"), required: true, dir: "ltr" },
          { name: "isActive", label: tf("isActive"), type: "switch" },
        ]}
        titleNew={t("costCenters.new")}
        titleEdit={t("costCenters.edit")}
        newDefaults={{ isActive: true }}
        saveAction={saveCostCenter}
        removeAction={removeCostCenter}
        can={perms}
        dialogSize="md"
      />
    </>
  );
}
