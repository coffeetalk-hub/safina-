import { listPage, type SP } from "@/modules/foundation/_shared/page-helpers";
import { enumOptions } from "@/modules/foundation/_shared/lookups";
import { taxes, taxColumns } from "@/modules/foundation/taxes/service";
import { saveTax, removeTax } from "@/modules/foundation/taxes/actions";
import { PageHeader } from "@/components/shell/page-header";
import { CrudList } from "@/components/forms/crud-list";
import { plain } from "@/components/data-table/types";

export default async function TaxesPage({ searchParams }: { searchParams: SP }) {
  const { session, params, t, tf, te, perms } = await listPage("tax", searchParams);
  const data = await taxes.list(session, params);
  const cats = enumOptions(te, "TaxCategory", ["STANDARD", "ZERO_RATED", "EXEMPT", "OUT_OF_SCOPE"]);
  return (
    <>
      <PageHeader title={t("taxes.title")} />
      <CrudList
        tableKey="taxes"
        columns={taxColumns(tf)}
        data={plain(data)}
        exportResource="taxes"
        filters={[{ key: "category", label: tf("category"), type: "select", options: cats }]}
        fields={[
          { name: "code", label: tf("code"), required: true, dir: "ltr" },
          { name: "category", label: tf("category"), type: "select", options: cats, required: true },
          { name: "nameAr", label: tf("nameAr"), required: true, dir: "rtl" },
          { name: "nameEn", label: tf("nameEn"), required: true, dir: "ltr" },
          { name: "rate", label: tf("ratePct"), type: "number", step: "0.01", visibleWhen: { field: "category", equals: "STANDARD" } },
          { name: "isDefault", label: tf("isDefault"), type: "switch" },
          { name: "isActive", label: tf("isActive"), type: "switch" },
        ]}
        titleNew={t("taxes.new")}
        titleEdit={t("taxes.edit")}
        newDefaults={{ category: "STANDARD", rate: 15, isDefault: false, isActive: true }}
        saveAction={saveTax}
        removeAction={removeTax}
        can={perms}
        dialogSize="md"
      />
    </>
  );
}
