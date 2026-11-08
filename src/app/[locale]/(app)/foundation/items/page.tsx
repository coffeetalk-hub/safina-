import { listPage, type SP } from "@/modules/foundation/_shared/page-helpers";
import { lookups, enumOptions } from "@/modules/foundation/_shared/lookups";
import { items, itemColumns } from "@/modules/foundation/items/service";
import { saveItem, removeItem } from "@/modules/foundation/items/actions";
import { PageHeader } from "@/components/shell/page-header";
import { CrudList } from "@/components/forms/crud-list";
import type { FieldConfig } from "@/components/forms/entity-dialog";
import { plain } from "@/components/data-table/types";

export default async function ItemsPage({ searchParams }: { searchParams: SP }) {
  const { session, locale, params, t, tf, te, perms } = await listPage("item", searchParams);
  const [data, lk] = await Promise.all([items.list(session, params), lookups(session.companyId, locale)]);
  const types = enumOptions(te, "ItemType", ["SERVICE", "NON_STOCK"]);

  const fields: FieldConfig[] = [
    { name: "code", label: tf("code"), placeholder: "auto", dir: "ltr" },
    { name: "type", label: tf("type"), type: "select", options: types, required: true },
    { name: "nameAr", label: tf("nameAr"), required: true, dir: "rtl" },
    { name: "nameEn", label: tf("nameEn"), required: true, dir: "ltr" },
    { name: "descriptionAr", label: tf("descriptionAr"), type: "textarea", dir: "rtl" },
    { name: "descriptionEn", label: tf("descriptionEn"), type: "textarea", dir: "ltr" },
    { name: "unit", label: tf("unit"), required: true, dir: "ltr" },
    { name: "taxCodeId", label: tf("taxCode"), type: "select", options: lk.taxCodes },
    { name: "salePrice", label: tf("salePrice"), type: "number" },
    { name: "costPrice", label: tf("costPrice"), type: "number" },
    { name: "revenueAccountId", label: tf("revenueAccount"), type: "select", options: lk.accountsByType(["REVENUE"]) },
    { name: "expenseAccountId", label: tf("expenseAccount"), type: "select", options: lk.accountsByType(["EXPENSE", "ASSET"]) },
    { name: "isSellable", label: tf("isSellable"), type: "switch" },
    { name: "isPurchasable", label: tf("isPurchasable"), type: "switch" },
    { name: "isActive", label: tf("isActive"), type: "switch" },
  ];

  return (
    <>
      <PageHeader title={t("items.title")} />
      <CrudList
        tableKey="items"
        columns={itemColumns(tf, locale)}
        data={plain(data)}
        exportResource="items"
        filters={[
          { key: "type", label: tf("type"), type: "select", options: types },
          { key: "isActive", label: tf("isActive"), type: "boolean" },
        ]}
        fields={fields}
        titleNew={t("items.new")}
        titleEdit={t("items.edit")}
        newDefaults={{ type: "SERVICE", unit: "EA", salePrice: 0, costPrice: 0, isSellable: true, isPurchasable: true, isActive: true }}
        saveAction={saveItem}
        removeAction={removeItem}
        can={perms}
        dialogSize="lg"
      />
    </>
  );
}
