import { financePage, type SP } from "@/modules/finance/_shared/page-helpers";
import { financeLookups } from "@/modules/finance/_shared/lookups";
import { trialBalance } from "@/modules/finance/reports/service";
import { reportFilter } from "@/modules/finance/reports/helpers";
import { PageHeader } from "@/components/shell/page-header";
import { ReportFilters } from "@/components/finance/report-filters";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatMoney } from "@/lib/money";
import { Link } from "@/i18n/navigation";

export default async function TrialBalancePage({ searchParams }: { searchParams: SP }) {
  const { session, locale, params, t, tf } = await financePage("report", searchParams);
  const f = reportFilter(params);
  const [lk, tb] = await Promise.all([financeLookups(session.companyId, locale), trialBalance(session, f)]);
  const m = (n: number) => (n ? formatMoney(n, locale) : "");
  return (
    <>
      <PageHeader title={t("reports.trialBalance")} description={`${f.fromIso} → ${f.toIso}`} />
      <ReportFilters from={f.fromIso} to={f.toIso} branchId={f.branchId ?? ""} costCenterId={f.costCenterId ?? ""} branches={lk.branches} costCenters={lk.costCenters} exportResource="trial-balance" />
      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead rowSpan={2}>{tf("code")}</TableHead>
              <TableHead rowSpan={2}>{t("account")}</TableHead>
              <TableHead colSpan={2} className="text-center border-s">{t("reports.opening")}</TableHead>
              <TableHead colSpan={2} className="text-center border-s">{t("reports.movement")}</TableHead>
              <TableHead colSpan={2} className="text-center border-s">{t("reports.closing")}</TableHead>
            </TableRow>
            <TableRow>
              {[0, 1, 2].map((i) => (<TableHead key={`d${i}`} className="text-end border-s">{t("debit")}</TableHead>)).flatMap((h, i) => [h, <TableHead key={`c${i}`} className="text-end">{t("credit")}</TableHead>])}
            </TableRow>
          </TableHeader>
          <TableBody>
            {tb.rows.map((r) => (
              <TableRow key={r.id} className={r.level <= 2 ? "bg-muted/30 font-medium" : ""}>
                <TableCell dir="ltr" style={{ paddingInlineStart: `${(r.level - 1) * 12 + 8}px` }}>{r.code}</TableCell>
                <TableCell><Link href={`/finance/reports/ledger?f.accountId=${r.id}&f.from=${f.fromIso}&f.to=${f.toIso}`} className="hover:underline">{locale === "ar" ? r.nameAr : r.nameEn}</Link></TableCell>
                <TableCell className="text-end tabular-nums border-s" dir="ltr">{m(r.openingDebit)}</TableCell>
                <TableCell className="text-end tabular-nums" dir="ltr">{m(r.openingCredit)}</TableCell>
                <TableCell className="text-end tabular-nums border-s" dir="ltr">{m(r.debit)}</TableCell>
                <TableCell className="text-end tabular-nums" dir="ltr">{m(r.credit)}</TableCell>
                <TableCell className="text-end tabular-nums border-s" dir="ltr">{m(r.closingDebit)}</TableCell>
                <TableCell className="text-end tabular-nums" dir="ltr">{m(r.closingCredit)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell colSpan={2}>{t("total")}</TableCell>
              {(["openingDebit", "openingCredit", "debit", "credit", "closingDebit", "closingCredit"] as const).map((k) => <TableCell key={k} className="text-end tabular-nums" dir="ltr">{formatMoney(tb.totals[k], locale)}</TableCell>)}
            </TableRow>
          </TableFooter>
        </Table>
      </div>
    </>
  );
}
