import { financePage, type SP } from "@/modules/finance/_shared/page-helpers";
import { financeLookups } from "@/modules/finance/_shared/lookups";
import { accountLedger } from "@/modules/finance/reports/service";
import { reportFilter } from "@/modules/finance/reports/helpers";
import { PageHeader } from "@/components/shell/page-header";
import { ReportFilters } from "@/components/finance/report-filters";
import { LedgerAccountPicker } from "./picker";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/dates";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";

export default async function LedgerPage({ searchParams }: { searchParams: SP }) {
  const { session, locale, params, t, tf } = await financePage("report", searchParams);
  const f = reportFilter(params);
  const lk = await financeLookups(session.companyId, locale);
  const accountId = params.filters.accountId || "";
  const ledger = accountId ? await accountLedger(session, accountId, f) : null;
  const acc = lk.accounts.find((a) => a.value === accountId);
  return (
    <>
      <PageHeader title={t("reports.ledger")} description={acc?.label} />
      <ReportFilters from={f.fromIso} to={f.toIso} branchId={f.branchId ?? ""} costCenterId={f.costCenterId ?? ""} branches={lk.branches} costCenters={lk.costCenters} extra={<LedgerAccountPicker accounts={lk.accounts} value={accountId} />} exportResource={accountId ? "ledger" : undefined} />
      {ledger && (
        <div className="rounded-md border bg-card">
          <Table>
            <TableHeader><TableRow><TableHead>{tf("date")}</TableHead><TableHead>{tf("number")}</TableHead><TableHead>{tf("description")}</TableHead><TableHead>{tf("costCenter")}</TableHead><TableHead className="text-end">{t("debit")}</TableHead><TableHead className="text-end">{t("credit")}</TableHead><TableHead className="text-end">{t("balance")}</TableHead></TableRow></TableHeader>
            <TableBody>
              <TableRow className="bg-muted/30 font-medium"><TableCell colSpan={6}>{t("reports.opening")}</TableCell><TableCell className="text-end tabular-nums" dir="ltr">{formatMoney(ledger.opening, locale)}</TableCell></TableRow>
              {ledger.rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell dir="ltr">{formatDate(r.date, locale)}</TableCell>
                  <TableCell><Link href={`/finance/journals/${r.entryId}`} className="text-primary hover:underline" dir="ltr">{r.number}</Link> <Badge variant="outline" className="text-[10px]">{r.source}</Badge></TableCell>
                  <TableCell>{r.description}</TableCell>
                  <TableCell dir="ltr">{r.costCenter}</TableCell>
                  <TableCell className="text-end tabular-nums" dir="ltr">{r.debit ? formatMoney(r.debit, locale) : ""}</TableCell>
                  <TableCell className="text-end tabular-nums" dir="ltr">{r.credit ? formatMoney(r.credit, locale) : ""}</TableCell>
                  <TableCell className="text-end tabular-nums" dir="ltr">{formatMoney(r.balance, locale)}</TableCell>
                </TableRow>
              ))}
              <TableRow className="bg-muted/40 font-semibold"><TableCell colSpan={4}>{t("reports.closing")}</TableCell><TableCell className="text-end tabular-nums" dir="ltr">{formatMoney(ledger.rows.reduce((a, r) => a + r.debit, 0), locale)}</TableCell><TableCell className="text-end tabular-nums" dir="ltr">{formatMoney(ledger.rows.reduce((a, r) => a + r.credit, 0), locale)}</TableCell><TableCell className="text-end tabular-nums" dir="ltr">{formatMoney(ledger.closing, locale)}</TableCell></TableRow>
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}
