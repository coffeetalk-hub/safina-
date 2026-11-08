import { hrPage, type SP } from "@/modules/hr/page-helpers";
import { financeLookups } from "@/modules/finance/_shared/lookups";
import { listRuns, runColumns } from "@/modules/hr/payroll";
import { enumOptions } from "@/modules/foundation/_shared/lookups";
import { PageHeader } from "@/components/shell/page-header";
import { DataTable } from "@/components/data-table/data-table";
import { plain } from "@/components/data-table/types";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { NewRunButton } from "./client";

export default async function PayrollPage({ searchParams }: { searchParams: SP }) {
  const { session, locale, params, t, tf, te, perms } = await hrPage("payroll", searchParams);
  const [data, lk] = await Promise.all([listRuns(session, params), financeLookups(session.companyId, locale)]);
  const d = new Date(); d.setUTCMonth(d.getUTCMonth());
  return (
    <>
      <PageHeader title={t("payroll.title")} description={t("payroll.hint")} actions={<>
        <Button variant="outline" asChild><Link href="/hr/settings">{t("settings.title")}</Link></Button>
        {perms.create && <NewRunButton branches={lk.branches} defaults={{ periodYear: d.getUTCFullYear(), periodMonth: d.getUTCMonth() + 1, payDate: new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 27)).toISOString().slice(0, 10) }} />}
      </>} />
      <DataTable tableKey="hr-payroll-runs" columns={runColumns(tf, t)} data={plain(data)} exportResource="hr-payroll-runs" rowHrefTemplate="/hr/payroll/{id}" filters={[
        { key: "status", label: tf("status"), type: "select", options: enumOptions(te, "PayrollStatus", ["DRAFT", "CALCULATED", "PENDING_APPROVAL", "APPROVED", "POSTED", "PAID", "CANCELLED"]) },
        { key: "year", label: t("year"), type: "text" },
      ]} />
    </>
  );
}
