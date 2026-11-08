import { financePage, type SP } from "@/modules/finance/_shared/page-helpers";
import { financeLookups } from "@/modules/finance/_shared/lookups";
import { bankAccounts, bankAccountColumns, withBalances } from "@/modules/finance/bank/service";
import { saveBankAccountAction, removeBankAccountAction } from "@/modules/finance/actions";
import { PageHeader } from "@/components/shell/page-header";
import { CrudList } from "@/components/forms/crud-list";
import { plain } from "@/components/data-table/types";

export default async function BankAccountsPage({ searchParams }: { searchParams: SP }) {
  const { session, locale, params, t, tf, perms } = await financePage("bank", searchParams);
  const [data, lk] = await Promise.all([bankAccounts.list(session, params), financeLookups(session.companyId, locale)]);
  const rows = await withBalances(session, data.rows as { id: string; accountId: string }[]);
  return (
    <>
      <PageHeader title={t("bank.title")} description={t("bank.hint")} />
      <CrudList
        tableKey="bank-accounts"
        columns={bankAccountColumns(tf, t)}
        data={plain({ ...data, rows })}
        rowHrefTemplate="/finance/bank/{id}"
        extraToolbar={null}
        fields={[
          { name: "code", label: tf("code"), required: true, dir: "ltr" },
          { name: "currencyCode", label: tf("currency"), type: "select", options: lk.currencies, required: true },
          { name: "nameAr", label: tf("nameAr"), required: true, dir: "rtl" },
          { name: "nameEn", label: tf("nameEn"), required: true, dir: "ltr" },
          { name: "bankName", label: tf("bankName") },
          { name: "accountNumber", label: t("accountNumber"), dir: "ltr" },
          { name: "iban", label: tf("iban"), dir: "ltr" },
          { name: "accountId", label: t("glAccount"), type: "select", options: lk.accounts.filter((a) => a.meta?.type === "ASSET"), required: true },
          { name: "isActive", label: tf("isActive"), type: "switch" },
        ]}
        titleNew={t("bank.new")}
        titleEdit={t("bank.edit")}
        newDefaults={{ currencyCode: "SAR", isActive: true }}
        saveAction={saveBankAccountAction}
        removeAction={removeBankAccountAction}
        can={perms}
        dialogSize="lg"
      />
    </>
  );
}
