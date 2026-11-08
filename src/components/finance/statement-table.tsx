import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { formatMoney } from "@/lib/money";
import type { StmtLine } from "@/modules/finance/reports/service";
import { cn } from "@/lib/utils";

/** Server component: renders a statement section (P&L / balance sheet). */
export function StatementSection({ title, lines, total, totalLabel, locale }: { title: string; lines: StmtLine[]; total: number; totalLabel: string; locale: string }) {
  return (
    <div className="rounded-md border bg-card mb-4">
      <div className="bg-primary/5 px-3 py-2 font-semibold">{title}</div>
      <Table>
        <TableBody>
          {lines.map((l, i) => (
            <TableRow key={`${l.code}-${i}`} className={cn(l.isHeader && "font-medium")}>
              <TableCell style={{ paddingInlineStart: `${(l.level - 1) * 16 + 12}px` }}>
                <span dir="ltr" className="text-muted-foreground me-2 text-xs">{l.code}</span>
                {locale === "ar" ? l.nameAr : l.nameEn}
              </TableCell>
              <TableCell className="text-end tabular-nums w-40" dir="ltr">{l.isHeader ? "" : formatMoney(l.amount, locale)}</TableCell>
              <TableCell className="text-end tabular-nums w-40 font-medium" dir="ltr">{l.isHeader && l.level <= 2 ? formatMoney(l.amount, locale) : ""}</TableCell>
            </TableRow>
          ))}
          <TableRow className="bg-muted/40 font-semibold">
            <TableCell>{totalLabel}</TableCell>
            <TableCell />
            <TableCell className="text-end tabular-nums" dir="ltr">{formatMoney(total, locale)}</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}
