import { financePage, type SP } from "@/modules/finance/_shared/page-helpers";
import { financeLookups } from "@/modules/finance/_shared/lookups";
import { balanceSheet } from "@/modules/finance/reports/service";
import { reportFilter } from "@/modules/finance/reports/helpers";
import { PageHeader } from "@/components/shell/page-header";
import { ReportFilters } from "@/components/finance/report-filters";
import { StatementSection } from "@/components/finance/statement-table";
import { formatMoney } from "@/lib/money";

export default async function BalanceSheetPage({ searchParams }: { searchParams: SP }) {
  const { session, locale, params, t } = await financePage("report", searchParams);
  const f = reportFilter(params);
  const [lk, bs] = await Promise.all([financeLookups(session.companyId, locale), balanceSheet(session, f)]);
  const diff = bs.assets.total - bs.totalLiabilitiesEquity;
  return (
    <>
      <PageHeader title={t("reports.balanceSheet")} description={`${t("asOf")} ${f.toIso}`} />
      <ReportFilters from={f.fromIso} to={f.toIso} branchId={f.branchId ?? ""} costCenterId={f.costCenterId ?? ""} branches={lk.branches} costCenters={lk.costCenters} exportResource="balance-sheet" showFrom={false} />
      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <StatementSection title={t("reports.assets")} lines={bs.assets.lines} total={bs.assets.total} totalLabel={t("reports.totalAssets")} locale={locale} />
        </div>
        <div>
          <StatementSection title={t("reports.liabilities")} lines={bs.liabilities.lines} total={bs.liabilities.total} totalLabel={t("reports.totalLiabilities")} locale={locale} />
          <StatementSection title={t("reports.equity")} lines={[...bs.equity.lines, { code: "", nameAr: "أرباح/خسائر الفترة الحالية", nameEn: "Current period earnings", level: 2, amount: bs.earnings, isHeader: false }]} total={bs.equity.total + bs.earnings} totalLabel={t("reports.totalEquity")} locale={locale} />
          <div className="rounded-md border px-4 py-3 flex justify-between font-bold">
            <span>{t("reports.totalLiabilitiesEquity")}</span>
            <span dir="ltr" className="tabular-nums">{formatMoney(bs.totalLiabilitiesEquity, locale)}</span>
          </div>
          {Math.abs(diff) > 0.005 && <p className="mt-2 text-sm text-destructive">{t("reports.outOfBalance")}: <span dir="ltr">{formatMoney(diff, locale)}</span></p>}
        </div>
      </div>
    </>
  );
}
