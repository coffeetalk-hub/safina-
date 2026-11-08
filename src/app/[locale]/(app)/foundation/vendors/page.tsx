import { listPage, type SP } from "@/modules/foundation/_shared/page-helpers";
import { lookups, enumOptions } from "@/modules/foundation/_shared/lookups";
import { vendors, vendorColumns } from "@/modules/foundation/vendors/service";
import { saveVendor, removeVendor } from "@/modules/foundation/vendors/actions";
import { PageHeader } from "@/components/shell/page-header";
import { CrudList } from "@/components/forms/crud-list";
import type { FieldConfig } from "@/components/forms/entity-dialog";
import { plain } from "@/components/data-table/types";

export default async function VendorsPage({ searchParams }: { searchParams: SP }) {
  const { session, locale, params, t, tf, te, perms } = await listPage("vendor", searchParams);
  const [data, lk] = await Promise.all([vendors.list(session, params), lookups(session.companyId, locale)]);
  const types = enumOptions(te, "PartyType", ["COMPANY", "INDIVIDUAL", "GOVERNMENT"]);

  const fields: FieldConfig[] = [
    { name: "code", label: tf("code"), placeholder: "auto", dir: "ltr" },
    { name: "type", label: tf("type"), type: "select", options: types, required: true },
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
    { name: "paymentTermsDays", label: tf("paymentTermsDays"), type: "number", required: true },
    { name: "currencyCode", label: tf("currency"), type: "select", options: lk.currencies, required: true },
    { name: "payableAccountId", label: tf("payableAccount"), type: "select", options: lk.accountsByType(["LIABILITY"]) },
    { name: "bankName", label: tf("bankName") },
    { name: "iban", label: tf("iban"), dir: "ltr" },
    { name: "isActive", label: tf("isActive"), type: "switch" },
    { name: "notes", label: tf("notes"), type: "textarea", colSpan: 2 },
  ];

  return (
    <>
      <PageHeader title={t("vendors.title")} />
      <CrudList
        tableKey="vendors"
        columns={vendorColumns(tf, locale)}
        data={plain(data)}
        exportResource="vendors"
        filters={[
          { key: "type", label: tf("type"), type: "select", options: types },
          { key: "isActive", label: tf("isActive"), type: "boolean" },
        ]}
        fields={fields}
        titleNew={t("vendors.new")}
        titleEdit={t("vendors.edit")}
        newDefaults={{ type: "COMPANY", country: "SA", paymentTermsDays: 30, currencyCode: "SAR", isActive: true }}
        saveAction={saveVendor}
        removeAction={removeVendor}
        can={perms}
        dialogSize="xl"
      />
    </>
  );
}
