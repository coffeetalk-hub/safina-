"use client";

import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Loader2, Play, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Combobox } from "@/components/ui/combobox";
import { useToast } from "@/components/ui/toast";
import { ConfirmButton } from "@/components/forms/confirm-button";
import { removeRecurringAction, runRecurringAction, saveRecurringAction } from "@/modules/finance/journals/actions";
import type { FinanceLookups } from "@/modules/finance/_shared/lookups";
import { formatDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";

type Line = { accountId: string; costCenterId: string | null; description: string; debit: number | string; credit: number | string };
type Row = { id: string; nameAr: string; nameEn: string; description: string | null; frequency: string; startDate: string; endDate: string | null; nextRunDate: string; lastRunDate: string | null; autoPost: boolean; isActive: boolean; lines: Line[]; _count: { entries: number } };

export function RecurringClient({ rows, lookups, can }: { rows: Row[]; lookups: FinanceLookups; can: { create: boolean; edit: boolean; delete: boolean } }) {
  const t = useTranslations("finance");
  const tf = useTranslations("fields");
  const tc = useTranslations("common");
  const te = useTranslations("errors");
  const tfr = useTranslations("enums.Frequency");
  const locale = useLocale();
  const toast = useToast();
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Row | null>(null);
  const [form, setForm] = React.useState({ nameAr: "", nameEn: "", description: "", frequency: "MONTHLY", startDate: new Date().toISOString().slice(0, 10), endDate: "", autoPost: false, isActive: true });
  const [lines, setLines] = React.useState<Line[]>([]);
  const [busy, setBusy] = React.useState(false);

  const openDialog = (r: Row | null) => {
    setEditing(r);
    setForm({ nameAr: r?.nameAr ?? "", nameEn: r?.nameEn ?? "", description: r?.description ?? "", frequency: r?.frequency ?? "MONTHLY", startDate: r?.startDate.slice(0, 10) ?? new Date().toISOString().slice(0, 10), endDate: r?.endDate?.slice(0, 10) ?? "", autoPost: r?.autoPost ?? false, isActive: r?.isActive ?? true });
    setLines(r?.lines.map((l) => ({ ...l, description: l.description ?? "", debit: l.debit || "", credit: l.credit || "" })) ?? [{ accountId: "", costCenterId: null, description: "", debit: "", credit: "" }, { accountId: "", costCenterId: null, description: "", debit: "", credit: "" }]);
    setOpen(true);
  };
  const totalD = lines.reduce((a, l) => a + Number(l.debit || 0), 0);
  const totalC = lines.reduce((a, l) => a + Number(l.credit || 0), 0);
  const upd = (i: number, p: Partial<Line>) => setLines((x) => x.map((l, j) => (j === i ? { ...l, ...p } : l)));

  const submit = async () => {
    setBusy(true);
    const res = await saveRecurringAction({ id: editing?.id ?? null, ...form, description: form.description || null, endDate: form.endDate || null, lines: lines.filter((l) => l.accountId).map((l) => ({ ...l, debit: Number(l.debit || 0), credit: Number(l.credit || 0) })) });
    setBusy(false);
    if (res.ok) {
      toast.success(tc("saved"));
      setOpen(false);
      router.refresh();
    } else toast.error(te.has(res.error) ? te(res.error) : res.error);
  };

  return (
    <>
      <div className="mb-3 flex flex-wrap justify-end gap-2">
        {can.create && (
          <ConfirmButton title={t("recurring.runNow")} action={runRecurringAction} variant="outline" onSuccess={(n) => toast.info(`${n}`)}>
            <Play /> {t("recurring.runNow")}
          </ConfirmButton>
        )}
        {can.create && (
          <Button onClick={() => openDialog(null)}>
            <Plus /> {t("recurring.new")}
          </Button>
        )}
      </div>
      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{tf("name")}</TableHead>
              <TableHead>{t("frequency")}</TableHead>
              <TableHead>{t("nextRun")}</TableHead>
              <TableHead>{t("lastRun")}</TableHead>
              <TableHead className="text-end">{tf("amount")}</TableHead>
              <TableHead className="text-center">{t("autoPost")}</TableHead>
              <TableHead className="text-center">{t("generated")}</TableHead>
              <TableHead className="text-center">{tf("isActive")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && <TableRow><TableCell colSpan={8} className="h-20 text-center text-muted-foreground">{tc("noData")}</TableCell></TableRow>}
            {rows.map((r) => (
              <TableRow key={r.id} className="cursor-pointer" onClick={() => can.edit && openDialog(r)}>
                <TableCell>{locale === "ar" ? r.nameAr : r.nameEn}</TableCell>
                <TableCell>{tfr(r.frequency)}</TableCell>
                <TableCell dir="ltr">{formatDate(r.nextRunDate, locale)}</TableCell>
                <TableCell dir="ltr">{formatDate(r.lastRunDate, locale) || "—"}</TableCell>
                <TableCell className="text-end tabular-nums" dir="ltr">{formatMoney(r.lines.reduce((a, l) => a + Number(l.debit || 0), 0), locale)}</TableCell>
                <TableCell className="text-center"><Badge variant={r.autoPost ? "success" : "secondary"}>{r.autoPost ? tc("yes") : tc("no")}</Badge></TableCell>
                <TableCell className="text-center">{r._count.entries}</TableCell>
                <TableCell className="text-center"><Badge variant={r.isActive ? "success" : "secondary"}>{r.isActive ? tc("active") : tc("inactive")}</Badge></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent size="xl">
          <DialogHeader><DialogTitle>{editing ? t("recurring.edit") : t("recurring.new")}</DialogTitle></DialogHeader>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1"><Label>{tf("nameAr")}</Label><Input dir="rtl" value={form.nameAr} onChange={(e) => setForm({ ...form, nameAr: e.target.value })} /></div>
            <div className="space-y-1"><Label>{tf("nameEn")}</Label><Input dir="ltr" value={form.nameEn} onChange={(e) => setForm({ ...form, nameEn: e.target.value })} /></div>
            <div className="space-y-1"><Label>{t("frequency")}</Label>
              <Select value={form.frequency} onValueChange={(v) => setForm({ ...form, frequency: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["WEEKLY", "MONTHLY", "QUARTERLY", "YEARLY"].map((f) => <SelectItem key={f} value={f}>{tfr(f)}</SelectItem>)}</SelectContent></Select>
            </div>
            <div className="space-y-1"><Label>{tf("startDate")}</Label><Input type="date" dir="ltr" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} /></div>
            <div className="space-y-1"><Label>{tf("endDate")}</Label><Input type="date" dir="ltr" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} /></div>
            <div className="flex items-center gap-4 pt-6">
              <label className="flex items-center gap-2 text-sm"><Switch checked={form.autoPost} onCheckedChange={(v) => setForm({ ...form, autoPost: v })} /> {t("autoPost")}</label>
              <label className="flex items-center gap-2 text-sm"><Switch checked={form.isActive} onCheckedChange={(v) => setForm({ ...form, isActive: v })} /> {tf("isActive")}</label>
            </div>
            <div className="space-y-1 sm:col-span-3"><Label>{tf("description")}</Label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          </div>
          <Table>
            <TableHeader><TableRow><TableHead>{t("account")}</TableHead><TableHead>{tf("costCenter")}</TableHead><TableHead>{tf("description")}</TableHead><TableHead className="text-end w-32">{t("debit")}</TableHead><TableHead className="text-end w-32">{t("credit")}</TableHead><TableHead className="w-8" /></TableRow></TableHeader>
            <TableBody>
              {lines.map((l, i) => (
                <TableRow key={i}>
                  <TableCell className="min-w-[220px]"><Combobox size="sm" options={lookups.accounts} value={l.accountId} onChange={(v) => upd(i, { accountId: v ?? "" })} allowClear={false} /></TableCell>
                  <TableCell className="min-w-[140px]"><Combobox size="sm" options={lookups.costCenters} value={l.costCenterId} onChange={(v) => upd(i, { costCenterId: v })} /></TableCell>
                  <TableCell><Input className="h-8" value={l.description} onChange={(e) => upd(i, { description: e.target.value })} /></TableCell>
                  <TableCell><Input className="h-8 text-end" type="number" dir="ltr" value={l.debit} onChange={(e) => upd(i, { debit: e.target.value })} /></TableCell>
                  <TableCell><Input className="h-8 text-end" type="number" dir="ltr" value={l.credit} onChange={(e) => upd(i, { credit: e.target.value })} /></TableCell>
                  <TableCell><Button variant="ghost" size="icon-sm" onClick={() => setLines((x) => x.filter((_, j) => j !== i))}><Trash2 className="size-3.5" /></Button></TableCell>
                </TableRow>
              ))}
              <TableRow className="font-semibold"><TableCell colSpan={3} className="text-end">{tc("total")}</TableCell><TableCell className="text-end" dir="ltr">{formatMoney(totalD, locale)}</TableCell><TableCell className="text-end" dir="ltr">{formatMoney(totalC, locale)}</TableCell><TableCell /></TableRow>
            </TableBody>
          </Table>
          <Button variant="outline" size="sm" onClick={() => setLines((x) => [...x, { accountId: "", costCenterId: null, description: "", debit: "", credit: "" }])}><Plus /> {t("addLine")}</Button>
          <DialogFooter className="sm:justify-between">
            <div>{editing && can.delete && <ConfirmButton title={tc("deleteConfirmTitle")} action={() => removeRecurringAction(editing.id)} variant="ghost" size="sm" onSuccess={() => setOpen(false)}><Trash2 className="text-destructive" /> <span className="text-destructive">{tc("delete")}</span></ConfirmButton>}</div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>{tc("cancel")}</Button>
              <Button onClick={submit} disabled={busy || Math.abs(totalD - totalC) > 0.005 || totalD === 0}>{busy && <Loader2 className="animate-spin" />} {tc("save")}</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
