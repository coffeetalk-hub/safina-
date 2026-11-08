import { listPage, type SP } from "@/modules/foundation/_shared/page-helpers";
import { listCompanies, companyColumns } from "@/modules/foundation/companies/service";
import { saveCompanyAction } from "@/modules/foundation/companies/actions";
import { PageHeader } from "@/components/shell/page-header";
import { CrudList } from "@/components/forms/crud-list";
import { plain } from "@/components/data-table/types";

export default async function CompaniesPage({ searchParams }: { searchParams: SP }) {
  const { session, params, t, tf, perms } = await listPage("company", searchParams);
  const data = await listCompanies(session, params);
  return (
    <>
      <PageHeader title={t("companies.title")} description={t("companies.assignedOnly")} />
      <CrudList
        tableKey="companies"
        columns={companyColumns(tf)}
        data={plain(data)}
        fields={[
          { name: "code", label: tf("code"), required: true, dir: "ltr" },
          { name: "baseCurrency", label: tf("baseCurrency"), required: true, dir: "ltr", disabled: true },
          { name: "nameAr", label: tf("nameAr"), required: true, dir: "rtl" },
          { name: "nameEn", label: tf("nameEn"), required: true, dir: "ltr" },
          { name: "crNumber", label: tf("crNumber"), dir: "ltr" },
          { name: "vatNumber", label: tf("vatNumber"), dir: "ltr" },
          { name: "phone", label: tf("phone"), dir: "ltr" },
          { name: "email", label: tf("email"), type: "email" },
          { name: "website", label: tf("website"), dir: "ltr" },
          { name: "city", label: tf("city") },
          { name: "addressAr", label: tf("addressAr"), dir: "rtl" },
          { name: "addressEn", label: tf("addressEn"), dir: "ltr" },
          { name: "isActive", label: tf("isActive"), type: "switch" },
        ]}
        titleNew={t("companies.new")}
        titleEdit={t("companies.edit")}
        newDefaults={{ baseCurrency: "SAR", country: "SA", isActive: true }}
        saveAction={saveCompanyAction}
        can={{ ...perms, create: session.isSuperAdmin }}
        dialogSize="lg"
      />
    </>
  );
}
