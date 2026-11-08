"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { FileCheck, Save } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ConfirmButton } from "@/components/forms/confirm-button";
import { fileVatReturnAction, saveVatReturnAction } from "@/modules/finance/actions";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/dates";

type Report = { rows: { key: string; amount: number; vat: number }[]; outputVat: number; inputVat: number; netVat: number };
type Ret = { id: string; number: string; periodStart: string; periodEnd: string; outputVat: number; inputVat: number; netVat: number; status: string; filedAt: string | null; journalEntryId: string | null };

export function VatClient({ from, to, report, returns, can }: { from: string; to: string; report: Report; returns: Ret[]; can: { create: boolean; approve: boolean } }) {
  const t = useTranslations("finance.vatReturn");
  const tf = useTranslations("fields");
  const tc = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const set = (k: string, v: string) => {
    const n = new URLSearchParams(sp.toString());
    n.set(k, v);
    router.push(`${pathname}?${n.toString()}`);
  };
  const row = (k: string) => report.rows.find((r) => r.key === k) ?? { amount: 0, vat: 0 };
  const boxes = [
    { n: 1, key: "salesStandard" }, { n: 2, key: "salesZero" }, { n: 3, key: "salesExempt" },
    { n: 4, key: "purchasesStandard" }, { n: 5, key: "purchasesZero" }, { n: 6, key: "purchasesExempt" },
  ];
  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="space-y-1"><Label>{tf("from")}</Label><Input type="date" dir="ltr" value={from} onChange={(e) => set("f.from", e.target.value)} className="w-44" /></div>
          <div className="space-y-1"><Label>{tf("to")}</Label><Input type="date" dir="ltr" value={to} onChange={(e) => set("f.to", e.target.value)} className="w-44" /></div>
          <div className="ms-auto">{can.create && <ConfirmButton title={t("saveReturn")} action={() => saveVatReturnAction({ from, to })} variant="default" size="sm"><Save /> {t("saveReturn")}</ConfirmButton>}</div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">{t("title")} · <span dir="ltr">{formatDate(from, locale)} → {formatDate(to, locale)}</span></CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead className="w-10">#</TableHead><TableHead>{t("box")}</TableHead><TableHead className="text-end">{t("amount")}</TableHead><TableHead className="text-end">{t("vatAmount")}</TableHead></TableRow></TableHeader>
            <TableBody>
              {boxes.map((b) => (
                <TableRow key={b.key} className={b.n === 4 ? "border-t-2" : ""}>
                  <TableCell>{b.n}</TableCell>
                  <TableCell>{t(`boxes.${b.key}`)}</TableCell>
                  <TableCell className="text-end tabular-nums" dir="ltr">{formatMoney(row(b.key).amount, locale)}</TableCell>
                  <TableCell className="text-end tabular-nums" dir="ltr">{b.key.endsWith("Standard") ? formatMoney(row(b.key).vat, locale) : "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow><TableCell colSpan={3}>{t("outputVat")}</TableCell><TableCell className="text-end tabular-nums" dir="ltr">{formatMoney(report.outputVat, locale)}</TableCell></TableRow>
              <TableRow><TableCell colSpan={3}>{t("inputVat")}</TableCell><TableCell className="text-end tabular-nums" dir="ltr">{formatMoney(report.inputVat, locale)}</TableCell></TableRow>
              <TableRow className="text-base"><TableCell colSpan={3}>{report.netVat >= 0 ? t("netPayable") : t("netRefundable")}</TableCell><TableCell className={`text-end tabular-nums font-bold ${report.netVat >= 0 ? "" : "text-emerald-700"}`} dir="ltr">{formatMoney(Math.abs(report.netVat), locale)}</TableCell></TableRow>
            </TableFooter>
          </Table>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">{t("history")}</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>{tf("number")}</TableHead><TableHead>{tf("period")}</TableHead><TableHead className="text-end">{t("outputVat")}</TableHead><TableHead className="text-end">{t("inputVat")}</TableHead><TableHead className="text-end">{t("net")}</TableHead><TableHead>{tc("status")}</TableHead><TableHead /></TableRow></TableHeader>
            <TableBody>
              {returns.length === 0 && <TableRow><TableCell colSpan={7} className="h-12 text-center text-muted-foreground">{tc("noData")}</TableCell></TableRow>}
              {returns.map((r) => (
                <TableRow key={r.id}>
                  <TableCell dir="ltr">{r.number}</TableCell>
                  <TableCell dir="ltr">{formatDate(r.periodStart, locale)} → {formatDate(r.periodEnd, locale)}</TableCell>
                  <TableCell className="text-end tabular-nums" dir="ltr">{formatMoney(r.outputVat, locale)}</TableCell>
                  <TableCell className="text-end tabular-nums" dir="ltr">{formatMoney(r.inputVat, locale)}</TableCell>
                  <TableCell className="text-end tabular-nums font-semibold" dir="ltr">{formatMoney(r.netVat, locale)}</TableCell>
                  <TableCell><Badge variant={r.status === "FILED" ? "success" : "secondary"}>{r.status}</Badge> {r.journalEntryId && <Link href={`/finance/journals/${r.journalEntryId}`} className="text-primary text-xs hover:underline">JV</Link>}</TableCell>
                  <TableCell>{r.status === "DRAFT" && can.approve && <ConfirmButton title={t("file")} description={t("fileHint")} action={() => fileVatReturnAction(r.id)} variant="outline" size="sm"><FileCheck /> {t("file")}</ConfirmButton>}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
