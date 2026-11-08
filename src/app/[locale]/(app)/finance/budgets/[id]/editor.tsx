"use client";

import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { ArrowLeft, CheckCircle2, Loader2, Plus, Save, Trash2, Undo2 } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Combobox } from "@/components/ui/combobox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { ConfirmButton } from "@/components/forms/confirm-button";
import { PageHeader } from "@/components/shell/page-header";
import { deleteBudgetAction, saveBudgetAction, setBudgetStatusAction } from "@/modules/finance/actions";
import type { FinanceLookups } from "@/modules/finance/_shared/lookups";
import { formatMoney, formatNumber } from "@/lib/money";

type Line = { accountId: string; costCenterId: string | null; monthly: (number | string)[] };
type Budget = { id: string; fiscalYearId: string; nameAr: string; nameEn: string; notes: string | null; status: string; lines: { accountId: string; costCenterId: string | null; monthly: unknown }[] } | null;
type VarianceRow = { accountCode: string; accountNameAr: string; accountNameEn: string; type: string; costCenter: string; budget: number; actual: number; variance: number; variancePct: number };

const MONTHS = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"];

export function BudgetEditor({ budget, lookups, years, can, variance }: { budget: Budget; lookups: FinanceLookups; years: { value: string; label: string }[]; can: { create: boolean; edit: boolean; delete: boolean; approve: boolean }; variance: { rows: VarianceRow[]; fromMonth: number; toMonth: number; costCenterId: string } | null }) {
  const t = useTranslations("finance");
  const tf = useTranslations("fields");
  const tc = useTranslations("common");
  const te = useTranslations("errors");
  const locale = useLocale();
  const toast = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const editable = !budget || budget.status === "DRAFT";
  const [head, setHead] = React.useState({ fiscalYearId: budget?.fiscalYearId ?? years[0]?.value ?? "", nameAr: budget?.nameAr ?? "", nameEn: budget?.nameEn ?? "", notes: budget?.notes ?? "" });
  const [lines, setLines] = React.useState<Line[]>(budget?.lines.map((l) => ({ accountId: l.accountId, costCenterId: l.costCenterId, monthly: (l.monthly as number[]).map((v) => v || "") })) ?? []);
  const [busy, setBusy] = React.useState(false);
  const plAccounts = lookups.accounts.filter((a) => a.meta?.type === "REVENUE" || a.meta?.type === "EXPENSE");
  const annual = (l: Line) => l.monthly.reduce<number>((a, v) => a + Number(v || 0), 0);
  const total = lines.reduce((a, l) => a + annual(l), 0);
  const upd = (i: number, patch: Partial<Line>) => setLines((p) => p.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const spread = (i: number, amount: number) => upd(i, { monthly: MONTHS.map(() => Math.round((amount / 12) * 100) / 100) });
  const set = (k: string, v: string) => {
    const n = new URLSearchParams(sp.toString());
    if (v) n.set(k, v);
    else n.delete(k);
    router.push(`${pathname}?${n.toString()}`);
  };

  const save = async () => {
    setBusy(true);
    const res = await saveBudgetAction({ id: budget?.id ?? null, ...head, notes: head.notes || null, lines: lines.filter((l) => l.accountId).map((l) => ({ ...l, monthly: l.monthly.map((v) => Number(v || 0)) })) });
    setBusy(false);
    if (res.ok) {
      toast.success(tc("saved"));
      if (!budget) router.replace(`/${locale}/finance/budgets/${(res.data as { id: string }).id}`);
      else router.refresh();
    } else toast.error(te.has(res.error) ? te(res.error) : res.error);
  };

  return (
    <>
      <PageHeader title={budget ? (locale === "ar" ? budget.nameAr : budget.nameEn) : t("budgets.new")} actions={<><Button variant="ghost" size="sm" asChild><Link href="/finance/budgets"><ArrowLeft className="rtl:rotate-180" /> {tc("back")}</Link></Button>{budget && <Badge variant={budget.status === "APPROVED" ? "success" : "secondary"}>{budget.status}</Badge>}</>} />
      <Tabs defaultValue="lines">
        <TabsList>
          <TabsTrigger value="lines">{t("budgets.lines")}</TabsTrigger>
          {budget && <TabsTrigger value="variance">{t("budgets.variance")}</TabsTrigger>}
        </TabsList>
        <TabsContent value="lines" className="space-y-4">
          <Card>
            <CardContent className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1"><Label>{t("fiscalYear")}</Label>
                <Select value={head.fiscalYearId} disabled={!editable || !!budget} onValueChange={(v) => setHead({ ...head, fiscalYearId: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{years.map((y) => <SelectItem key={y.value} value={y.value}>{y.label}</SelectItem>)}</SelectContent></Select>
              </div>
              <div className="space-y-1"><Label>{tf("nameAr")}</Label><Input dir="rtl" value={head.nameAr} disabled={!editable} onChange={(e) => setHead({ ...head, nameAr: e.target.value })} /></div>
              <div className="space-y-1"><Label>{tf("nameEn")}</Label><Input dir="ltr" value={head.nameEn} disabled={!editable} onChange={(e) => setHead({ ...head, nameEn: e.target.value })} /></div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="overflow-x-auto">
              <Table className="text-xs">
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[220px]">{t("account")}</TableHead>
                    <TableHead className="min-w-[130px]">{tf("costCenter")}</TableHead>
                    {MONTHS.map((m) => <TableHead key={m} className="text-end w-20">{m}</TableHead>)}
                    <TableHead className="text-end w-28">{t("annual")}</TableHead>
                    {editable && <TableHead className="w-10" />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lines.map((l, i) => (
                    <TableRow key={i}>
                      <TableCell><Combobox size="sm" options={plAccounts} value={l.accountId} disabled={!editable} onChange={(v) => upd(i, { accountId: v ?? "" })} allowClear={false} /></TableCell>
                      <TableCell><Combobox size="sm" options={lookups.costCenters} value={l.costCenterId} disabled={!editable} onChange={(v) => upd(i, { costCenterId: v })} /></TableCell>
                      {MONTHS.map((m, mi) => <TableCell key={m}><Input className="h-7 px-1 text-end text-xs" type="number" dir="ltr" value={l.monthly[mi]} disabled={!editable} onChange={(e) => upd(i, { monthly: l.monthly.map((v, j) => (j === mi ? e.target.value : v)) })} /></TableCell>)}
                      <TableCell className="text-end"><Input className="h-7 px-1 text-end text-xs font-semibold" type="number" dir="ltr" value={annual(l) || ""} disabled={!editable} onChange={(e) => spread(i, Number(e.target.value || 0))} title={t("spreadEvenly")} /></TableCell>
                      {editable && <TableCell><Button variant="ghost" size="icon-sm" onClick={() => setLines((p) => p.filter((_, j) => j !== i))}><Trash2 className="size-3.5" /></Button></TableCell>}
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter><TableRow><TableCell colSpan={14} className="text-end">{t("total")}</TableCell><TableCell className="text-end tabular-nums" dir="ltr">{formatMoney(total, locale)}</TableCell>{editable && <TableCell />}</TableRow></TableFooter>
              </Table>
              {editable && <Button variant="outline" size="sm" className="mt-3" onClick={() => setLines((p) => [...p, { accountId: "", costCenterId: null, monthly: MONTHS.map(() => "") }])}><Plus /> {t("addLine")}</Button>}
            </CardContent>
          </Card>
          <div className="flex flex-wrap gap-2">
            {editable && (can.create || can.edit) && <Button onClick={save} disabled={busy || !head.nameAr || !head.nameEn || !head.fiscalYearId}>{busy ? <Loader2 className="animate-spin" /> : <Save />} {tc("save")}</Button>}
            {budget && budget.status === "DRAFT" && can.approve && <ConfirmButton title={tc("approve")} action={() => setBudgetStatusAction(budget.id, "APPROVED")} variant="secondary"><CheckCircle2 /> {tc("approve")}</ConfirmButton>}
            {budget && budget.status === "APPROVED" && can.approve && <ConfirmButton title={t("reopen")} action={() => setBudgetStatusAction(budget.id, "DRAFT")} variant="outline"><Undo2 /> {t("reopen")}</ConfirmButton>}
            {budget && can.delete && <ConfirmButton title={tc("deleteConfirmTitle")} action={() => deleteBudgetAction(budget.id)} variant="ghost" onSuccess={() => router.push(`/${locale}/finance/budgets`)}><Trash2 className="text-destructive" /></ConfirmButton>}
          </div>
        </TabsContent>
        {budget && variance && (
          <TabsContent value="variance" className="space-y-3">
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1"><Label>{tf("from")}</Label><Select value={String(variance.fromMonth)} onValueChange={(v) => set("f.fromMonth", v)}><SelectTrigger className="w-24"><SelectValue /></SelectTrigger><SelectContent>{MONTHS.map((m, i) => <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-1"><Label>{tf("to")}</Label><Select value={String(variance.toMonth)} onValueChange={(v) => set("f.toMonth", v)}><SelectTrigger className="w-24"><SelectValue /></SelectTrigger><SelectContent>{MONTHS.map((m, i) => <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-1 min-w-[220px]"><Label>{tf("costCenter")}</Label><Combobox options={lookups.costCenters} value={variance.costCenterId} onChange={(v) => set("f.costCenterId", v ?? "")} /></div>
            </div>
            <div className="rounded-md border bg-card">
              <Table>
                <TableHeader><TableRow><TableHead>{t("account")}</TableHead><TableHead>{tf("costCenter")}</TableHead><TableHead className="text-end">{t("budgets.budget")}</TableHead><TableHead className="text-end">{t("budgets.actual")}</TableHead><TableHead className="text-end">{t("budgets.varianceAmt")}</TableHead><TableHead className="text-end">%</TableHead></TableRow></TableHeader>
                <TableBody>
                  {variance.rows.map((r, i) => (
                    <TableRow key={i}>
                      <TableCell><span dir="ltr">{r.accountCode}</span> · {locale === "ar" ? r.accountNameAr : r.accountNameEn}</TableCell>
                      <TableCell dir="ltr">{r.costCenter}</TableCell>
                      <TableCell className="text-end tabular-nums" dir="ltr">{formatMoney(r.budget, locale)}</TableCell>
                      <TableCell className="text-end tabular-nums" dir="ltr">{formatMoney(r.actual, locale)}</TableCell>
                      <TableCell className={`text-end tabular-nums ${(r.type === "EXPENSE" ? r.variance < 0 : r.variance > 0) ? "text-destructive" : "text-emerald-700"}`} dir="ltr">{formatMoney(r.variance, locale)}</TableCell>
                      <TableCell className="text-end tabular-nums" dir="ltr">{formatNumber(r.variancePct, locale, 1)}%</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter><TableRow><TableCell colSpan={2}>{t("total")}</TableCell><TableCell className="text-end tabular-nums" dir="ltr">{formatMoney(variance.rows.reduce((a, r) => a + r.budget, 0), locale)}</TableCell><TableCell className="text-end tabular-nums" dir="ltr">{formatMoney(variance.rows.reduce((a, r) => a + r.actual, 0), locale)}</TableCell><TableCell className="text-end tabular-nums" dir="ltr">{formatMoney(variance.rows.reduce((a, r) => a + r.variance, 0), locale)}</TableCell><TableCell /></TableRow></TableFooter>
              </Table>
            </div>
          </TabsContent>
        )}
      </Tabs>
    </>
  );
}
