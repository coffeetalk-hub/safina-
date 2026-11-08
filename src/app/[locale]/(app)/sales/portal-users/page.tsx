import { salesPage, type SP } from "@/modules/sales/page-helpers";
import { financeLookups } from "@/modules/finance/_shared/lookups";
import { listPortalUsers } from "@/modules/sales/portal";
import { savePortalUserAction, deletePortalUserAction } from "@/modules/sales/actions";
import { PageHeader } from "@/components/shell/page-header";
import { CrudList } from "@/components/forms/crud-list";
import { plain } from "@/components/data-table/types";

export default async function PortalUsersPage({ searchParams }: { searchParams: SP }) {
  const { session, locale, t, tf, perms } = await salesPage("portal", searchParams);
  const [rows, lk] = await Promise.all([listPortalUsers(session), financeLookups(session.companyId, locale)]);
  return (
    <>
      <PageHeader title={t("portalUsers.title")} description={t("portalUsers.hint")} />
      <CrudList tableKey="portal-users" columns={[
        { key: "name", label: tf("name") },
        { key: "email", label: tf("email") },
        { key: "customer", label: t("customer"), bilingual: "customer.name" },
        { key: "locale", label: tf("locale"), type: "enum", enumName: "Locale", align: "center" },
        { key: "lastLoginAt", label: t("portalUsers.lastLogin"), type: "datetime" },
        { key: "isActive", label: tf("isActive"), type: "boolean", align: "center" },
      ]} data={plain({ rows, total: rows.length, page: 1, pageSize: 100 })} fields={[
        { name: "customerId", label: t("customer"), type: "select", options: lk.customers, required: true, colSpan: 2 },
        { name: "name", label: tf("name"), required: true },
        { name: "email", label: tf("email"), type: "email", required: true },
        { name: "password", label: tf("password"), type: "password", description: t("portalUsers.passwordHint") },
        { name: "locale", label: tf("locale"), type: "select", options: [{ value: "ar", label: "العربية" }, { value: "en", label: "English" }], required: true },
        { name: "isActive", label: tf("isActive"), type: "switch" },
      ]} titleNew={t("portalUsers.new")} titleEdit={t("portalUsers.edit")} newDefaults={{ locale: "ar", isActive: true }} saveAction={savePortalUserAction} removeAction={deletePortalUserAction} can={perms} dialogSize="md" />
    </>
  );
}
