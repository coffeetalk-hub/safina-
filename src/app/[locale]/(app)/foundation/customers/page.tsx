import { listPage, type SP } from "@/modules/foundation/_shared/page-helpers";
import { lookups, enumOptions } from "@/modules/foundation/_shared/lookups";
import { customers } from "@/modules/foundation/customers/service";
import { customerColumns } from "@/modules/foundation/customers/columns";
import { saveCustomer, removeCustomer } from "@/modules/foundation/customers/actions";
import { PageHeader } from "@/components/shell/page-header";
import { CrudList } from "@/components/forms/crud-list";
import type { FieldConfig } from "@/components/forms/entity-dialog";
import { plain } from "@/components/data-table/types";

export default async function CustomersPage({ searchParams }: { searchParams: SP }) {
  const { session, locale, params, t, tf, te, perms } = await listPage("customer", searchParams);
  const [data, lk] = await Promise.all([customers.list(session, params), lookups(session.companyId, locale)]);

  const fields: FieldConfig[] = [
    { name: "code", label: tf("code"), placeholder: "auto", dir: "ltr" },
    { name: "type", label: tf("type"), type: "select", options: enumOptions(te, "PartyType", ["COMPANY", "INDIVIDUAL", "GOVERNMENT"]), required: true },
    { name: "nameAr", label: tf("nameAr"), required: true, dir: "rtl" },
    { name: "nameEn", label: tf("nameEn"), required: true, dir: "ltr" },
    { name: "vatNumber", label: tf("vatNumber"), dir: "ltr" },
    { name: "crNumber", label: tf("crNumber"), dir: "ltr" },
    { name: "email", label: tf("email"), type: "email" },
    { name: "phone", label: tf("phone"), dir: "ltr" },
    { name: "mobile", label: tf("mobile"), dir: "ltr" },
    { name: "contactPerson", label: tf("contactPerson") },
    { name: "addressAr", label: tf("addressAr"), dir: "rtl" },
    { name: "addressEn", label: tf("addressEn"), dir: "ltr" },
    { name: "city", label: tf("city") },
    { name: "district", label: tf("district") },
    { name: "buildingNo", label: tf("buildingNo"), dir: "ltr" },
    { name: "postalCode", label: tf("postalCode"), dir: "ltr" },
    { name: "paymentTermsDays", label: tf("paymentTermsDays"), type: "number", required: true },
    { name: "currencyCode", label: tf("currency"), type: "select", options: lk.currencies, required: true },
    { name: "creditLimit", label: tf("creditLimit"), type: "number" },
    { name: "blockOnCreditExceed", label: tf("blockOnCreditExceed"), type: "switch" },
    { name: "receivableAccountId", label: tf("receivableAccount"), type: "select", options: lk.accountsByType(["ASSET"]) },
    { name: "isActive", label: tf("isActive"), type: "switch" },
    { name: "notes", label: tf("notes"), type: "textarea", colSpan: 2 },
  ];

  return (
    <>
      <PageHeader title={t("customers.title")} />
      <CrudList
        tableKey="customers"
        columns={customerColumns(tf, locale)}
        data={plain(data)}
        exportResource="customers"
        filters={[
          { key: "type", label: tf("type"), type: "select", options: enumOptions(te, "PartyType", ["COMPANY", "INDIVIDUAL", "GOVERNMENT"]) },
          { key: "isActive", label: tf("isActive"), type: "boolean" },
        ]}
        fields={fields}
        titleNew={t("customers.new")}
        titleEdit={t("customers.edit")}
        newDefaults={{ type: "COMPANY", country: "SA", paymentTermsDays: 30, currencyCode: "SAR", creditLimit: 0, blockOnCreditExceed: true, isActive: true }}
        saveAction={saveCustomer}
        removeAction={removeCustomer}
        can={perms}
        dialogSize="xl"
      />
    </>
  );
}
