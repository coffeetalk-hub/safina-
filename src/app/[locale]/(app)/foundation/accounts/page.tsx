import { listPage, type SP } from "@/modules/foundation/_shared/page-helpers";
import { lookups, enumOptions } from "@/modules/foundation/_shared/lookups";
import { accounts, accountColumns, getMappings, MAPPING_KEYS } from "@/modules/foundation/accounts/service";
import { saveAccount, removeAccount, saveAccountMappings } from "@/modules/foundation/accounts/actions";
import { PageHeader } from "@/components/shell/page-header";
import { CrudList } from "@/components/forms/crud-list";
import { plain } from "@/components/data-table/types";
import { prisma } from "@/lib/prisma";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MappingsForm } from "./mappings-form";

export default async function AccountsPage({ searchParams }: { searchParams: SP }) {
  const { session, locale, params, t, tf, te, perms } = await listPage("account", searchParams);
  const [data, lk, mappings, headers] = await Promise.all([
    accounts.list(session, params),
    lookups(session.companyId, locale),
    getMappings(session.companyId),
    prisma.account.findMany({ where: { companyId: session.companyId, isActive: true }, orderBy: { code: "asc" }, select: { id: true, code: true, nameAr: true, nameEn: true } }),
  ]);
  const types = enumOptions(te, "AccountType", ["ASSET", "LIABILITY", "EQUITY", "REVENUE", "EXPENSE"]);
  const parentOptions = headers.map((h) => ({ value: h.id, label: `${h.code} · ${locale === "ar" ? h.nameAr : h.nameEn}` }));

  return (
    <>
      <PageHeader title={t("accounts.title")} />
      <Tabs defaultValue="list">
        <TabsList>
          <TabsTrigger value="list">{t("accounts.title")}</TabsTrigger>
          <TabsTrigger value="mappings">{t("accounts.mappings")}</TabsTrigger>
        </TabsList>
        <TabsContent value="list">
          <CrudList
            tableKey="accounts"
            columns={accountColumns(tf)}
            data={plain(data)}
            exportResource="accounts"
            filters={[
              { key: "type", label: tf("accountType"), type: "select", options: types },
              { key: "isPostable", label: tf("isPostable"), type: "boolean" },
              { key: "isActive", label: tf("isActive"), type: "boolean" },
            ]}
            fields={[
              { name: "code", label: tf("code"), required: true, dir: "ltr" },
              { name: "type", label: tf("accountType"), type: "select", options: types, required: true },
              { name: "nameAr", label: tf("nameAr"), required: true, dir: "rtl" },
              { name: "nameEn", label: tf("nameEn"), required: true, dir: "ltr" },
              { name: "parentId", label: tf("parent"), type: "select", options: parentOptions },
              { name: "currencyCode", label: tf("currency"), type: "select", options: lk.currencies },
              { name: "isPostable", label: tf("isPostable"), type: "switch" },
              { name: "isControl", label: tf("isControl"), type: "switch" },
              { name: "isActive", label: tf("isActive"), type: "switch" },
            ]}
            titleNew={t("accounts.new")}
            titleEdit={t("accounts.edit")}
            newDefaults={{ type: "ASSET", isPostable: true, isControl: false, isActive: true }}
            saveAction={saveAccount}
            removeAction={removeAccount}
            can={perms}
            dialogSize="lg"
          />
        </TabsContent>
        <TabsContent value="mappings">
          <p className="mb-3 text-sm text-muted-foreground">{t("accounts.mappingsHint")}</p>
          <MappingsForm keys={[...MAPPING_KEYS]} current={Object.fromEntries(Object.entries(mappings).map(([k, v]) => [k, v.id]))} options={lk.accounts} action={saveAccountMappings} canEdit={perms.edit} />
        </TabsContent>
      </Tabs>
    </>
  );
}
