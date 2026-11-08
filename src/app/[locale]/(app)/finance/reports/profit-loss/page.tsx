import { financePage, type SP } from "@/modules/finance/_shared/page-helpers";
import { financeLookups } from "@/modules/finance/_shared/lookups";
import { profitLoss } from "@/modules/finance/reports/service";
import { reportFilter } from "@/modules/finance/reports/helpers";
import { PageHeader } from "@/components/shell/page-header";
import { ReportFilters } from "@/components/finance/report-filters";
import { StatementSection } from "@/components/finance/statement-table";
import { formatMoney } from "@/lib/money";

export default async function ProfitLossPage({ searchParams }: { searchParams: SP }) {
  const { session, locale, params, t } = await financePage("report", searchParams);
  const f = reportFilter(params);
  const [lk, pl] = await Promise.all([financeLookups(session.companyId, locale), profitLoss(session, f)]);
  return (
    <>
      <PageHeader title={t("reports.profitLoss")} description={`${f.fromIso} → ${f.toIso}`} />
      <ReportFilters from={f.fromIso} to={f.toIso} branchId={f.branchId ?? ""} costCenterId={f.costCenterId ?? ""} branches={lk.branches} costCenters={lk.costCenters} exportResource="profit-loss" />
      <StatementSection title={t("reports.revenue")} lines={pl.revenue.lines} total={pl.revenue.total} totalLabel={t("reports.totalRevenue")} locale={locale} />
      <StatementSection title={t("reports.expenses")} lines={pl.expenses.lines} total={pl.expenses.total} totalLabel={t("reports.totalExpenses")} locale={locale} />
      <div className={`rounded-md border px-4 py-3 flex justify-between text-lg font-bold ${pl.netIncome >= 0 ? "bg-emerald-50 dark:bg-emerald-950/30" : "bg-red-50 dark:bg-red-950/30"}`}>
        <span>{pl.netIncome >= 0 ? t("reports.netProfit") : t("reports.netLoss")}</span>
        <span dir="ltr" className="tabular-nums">{formatMoney(Math.abs(pl.netIncome), locale)}</span>
      </div>
    </>
  );
}
