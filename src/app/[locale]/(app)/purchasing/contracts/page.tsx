import { purchasingPage, type SP } from "@/modules/purchasing/page-helpers";
import { financeLookups } from "@/modules/finance/_shared/lookups";
import { contracts, contractColumns, withDaysLeft } from "@/modules/purchasing/contracts";
import { saveContractAction, removeContractAction } from "@/modules/purchasing/actions";
import { enumOptions } from "@/modules/foundation/_shared/lookups";
import { PageHeader } from "@/components/shell/page-header";
import { CrudList } from "@/components/forms/crud-list";
import { plain } from "@/components/data-table/types";

export default async function ContractsPage({ searchParams }: { searchParams: SP }) {
  const { session, locale, params, t, tf, te, tc, perms } = await purchasingPage("contract", searchParams);
  const [data, lk] = await Promise.all([contracts.list(session, params), financeLookups(session.companyId, locale)]);
  const rows = withDaysLeft(data.rows as { endDate: Date }[]);
  const today = new Date(); const nextYear = new Date(today); nextYear.setUTCFullYear(today.getUTCFullYear() + 1);
  const expiring = rows.filter((r) => r.daysLeft <= Number((r as { alertDays?: number }).alertDays ?? 30) && (r as { status?: string }).status === "ACTIVE").length;
  return (
    <>
      <PageHeader title={t("contracts.title")} description={expiring > 0 ? t("contracts.expiringHint", { n: expiring }) : t("contracts.hint")} />
      <CrudList tableKey="vendor-contracts" columns={contractColumns(tf, t)} data={plain({ ...data, rows })} exportResource="vendor-contracts" dialogSize="xl" dateFields={["startDate", "endDate"]}
        filters={[
          { key: "status", label: tf("status"), type: "select", options: enumOptions(te, "ContractStatus", ["DRAFT", "ACTIVE", "EXPIRED", "TERMINATED"]) },
          { key: "vendorId", label: t("vendor"), type: "select", options: lk.vendors },
          { key: "expiring", label: t("contracts.expiringSoon"), type: "select", options: [{ value: "true", label: tc("yes") }] },
        ]}
        titleNew={t("contracts.new")} titleEdit={t("contracts.edit")}
        newDefaults={{ vendorId: "", number: "", titleAr: "", titleEn: "", startDate: today.toISOString().slice(0, 10), endDate: nextYear.toISOString().slice(0, 10), value: 0, currencyCode: "SAR", alertDays: 30, autoRenew: false, status: "ACTIVE", ownerId: "", termsAr: "", termsEn: "" }}
        fields={[
          { name: "vendorId", label: t("vendor"), type: "select", options: lk.vendors, required: true, colSpan: 2 },
          { name: "titleAr", label: tf("titleAr"), required: true, dir: "rtl" }, { name: "titleEn", label: tf("titleEn"), required: true, dir: "ltr" },
          { name: "number", label: tf("number"), dir: "ltr", description: t("contracts.numberHint") },
          { name: "status", label: tf("status"), type: "select", options: enumOptions(te, "ContractStatus", ["DRAFT", "ACTIVE", "EXPIRED", "TERMINATED"]) },
          { name: "startDate", label: tf("startDate"), type: "date", required: true }, { name: "endDate", label: tf("endDate"), type: "date", required: true },
          { name: "value", label: t("contractValue"), type: "number", step: "0.01" }, { name: "currencyCode", label: tf("currency"), type: "select", options: lk.currencies },
          { name: "alertDays", label: t("alertDays"), type: "number", description: t("contracts.alertHint") }, { name: "autoRenew", label: t("autoRenew"), type: "switch" },
          { name: "ownerId", label: t("contractOwner"), type: "select", options: lk.employees, colSpan: 2 },
          { name: "termsAr", label: t("termsAr"), type: "textarea", dir: "rtl" }, { name: "termsEn", label: t("termsEn"), type: "textarea", dir: "ltr" },
        ]}
        saveAction={saveContractAction} removeAction={removeContractAction} can={perms} />
    </>
  );
}
