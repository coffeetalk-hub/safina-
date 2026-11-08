import { hrPage, type SP } from "@/modules/hr/page-helpers";
import { headcount, payrollByMonth, payrollByCostCenter, gosiSummary, leaveSummary, expiringItems } from "@/modules/hr/reports";
import { PageHeader } from "@/components/shell/page-header";
import { plain } from "@/components/data-table/types";
import { HrReportsClient } from "./client";

export default async function HrReportsPage({ searchParams }: { searchParams: SP }) {
  const { session, params, t } = await hrPage("report", searchParams);
  const year = Number(params.filters.year) || new Date().getUTCFullYear();
  const [hc, byMonth, byCc, gosi, leave, expiring] = await Promise.all([headcount(session), payrollByMonth(session, year), payrollByCostCenter(session, year), gosiSummary(session, year), leaveSummary(session, year), expiringItems(session)]);
  return (
    <>
      <PageHeader title={t("reports.title")} description={`${year}`} />
      <HrReportsClient year={year} data={plain({ hc, byMonth, byCc, gosi, leave, expiring })} />
    </>
  );
}
