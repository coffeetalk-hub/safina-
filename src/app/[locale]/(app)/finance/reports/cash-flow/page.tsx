import { financePage, type SP } from "@/modules/finance/_shared/page-helpers";
import { financeLookups } from "@/modules/finance/_shared/lookups";
import { cashFlow } from "@/modules/finance/reports/service";
import { reportFilter } from "@/modules/finance/reports/helpers";
import { PageHeader } from "@/components/shell/page-header";
import { ReportFilters } from "@/components/finance/report-filters";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { formatMoney } from "@/lib/money";

type T = (k: string) => string;

function CfSection({ title, data, t, locale }: { title: string; data: Record<string, number>; t: T; locale: string }) {
  const total = Object.values(data).reduce((a, v) => a + v, 0);
  return (
    <>
      <TableRow className="bg-primary/5 font-semibold"><TableCell colSpan={2}>{title}</TableCell></TableRow>
      {Object.entries(data).map(([k, v]) => (
        <TableRow key={k}><TableCell className="ps-8">{t(`reports.cf.${k}`)}</TableCell><TableCell className={`text-end tabular-nums ${v < 0 ? "text-destructive" : ""}`} dir="ltr">{formatMoney(v, locale)}</TableCell></TableRow>
      ))}
      <TableRow className="font-medium"><TableCell className="ps-4">{t("reports.cf.netFrom")} {title}</TableCell><TableCell className="text-end tabular-nums" dir="ltr">{formatMoney(total, locale)}</TableCell></TableRow>
    </>
  );
}

export default async function CashFlowPage({ searchParams }: { searchParams: SP }) {
  const { session, locale, params, t } = await financePage("report", searchParams);
  const f = reportFilter(params);
  const [lk, cf] = await Promise.all([financeLookups(session.companyId, locale), cashFlow(session, f)]);
  return (
    <>
      <PageHeader title={t("reports.cashFlow")} description={`${f.fromIso} → ${f.toIso}`} />
      <ReportFilters from={f.fromIso} to={f.toIso} branchId={f.branchId ?? ""} costCenterId={f.costCenterId ?? ""} branches={lk.branches} costCenters={lk.costCenters} />
      <div className="rounded-md border bg-card max-w-3xl">
        <Table>
          <TableBody>
            <TableRow className="font-medium"><TableCell>{t("reports.cf.opening")}</TableCell><TableCell className="text-end tabular-nums" dir="ltr">{formatMoney(cf.opening, locale)}</TableCell></TableRow>
            <CfSection title={t("reports.cf.operating")} data={cf.operating} t={t} locale={locale} />
            <CfSection title={t("reports.cf.investing")} data={cf.investing} t={t} locale={locale} />
            <CfSection title={t("reports.cf.financing")} data={cf.financing} t={t} locale={locale} />
            <TableRow className="font-semibold bg-muted/40"><TableCell>{t("reports.cf.netChange")}</TableCell><TableCell className="text-end tabular-nums" dir="ltr">{formatMoney(cf.netChange, locale)}</TableCell></TableRow>
            <TableRow className="font-bold text-base"><TableCell>{t("reports.cf.closing")}</TableCell><TableCell className="text-end tabular-nums" dir="ltr">{formatMoney(cf.closing, locale)}</TableCell></TableRow>
          </TableBody>
        </Table>
      </div>
    </>
  );
}
