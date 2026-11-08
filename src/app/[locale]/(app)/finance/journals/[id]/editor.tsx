"use client";

import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Plus, Save, Send, Trash2, Undo2 } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Combobox } from "@/components/ui/combobox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { ConfirmButton } from "@/components/forms/confirm-button";
import { AttachmentsPanel, type AttachmentItem } from "@/components/attachments/attachments-panel";
import { DocStatus, PdfButtons } from "@/components/finance/doc-toolbar";
import { PageHeader } from "@/components/shell/page-header";
import { deleteJournalAction, postJournalAction, reverseJournalAction, saveJournalAction } from "@/modules/finance/journals/actions";
import type { FinanceLookups } from "@/modules/finance/_shared/lookups";
import { formatMoney } from "@/lib/money";

type Line = { accountId: string; costCenterId: string | null; description: string; debit: number | string; credit: number | string };
type Entry = { id: string; number: string; entryDate: string; branchId: string | null; description: string | null; reference: string | null; currencyCode: string; exchangeRate: number; status: string; source: string; reversalOfId: string | null; lines: { accountId: string; costCenterId: string | null; description: string | null; debit: number; credit: number }[] } | null;

const emptyLine = (): Line => ({ accountId: "", costCenterId: null, description: "", debit: "", credit: "" });

export function JournalEditor({ entry, lookups, can, attachments, canAttach }: { entry: Entry; lookups: FinanceLookups; can: { create: boolean; edit: boolean; delete: boolean; approve: boolean }; attachments: AttachmentItem[]; canAttach: { upload: boolean; delete: boolean } }) {
  const t = useTranslations("finance");
  const tf = useTranslations("fields");
  const tc = useTranslations("common");
  const te = useTranslations("errors");
  const locale = useLocale();
  const toast = useToast();
  const router = useRouter();
  const editable = !entry || entry.status === "DRAFT";
  const [head, setHead] = React.useState({ entryDate: entry?.entryDate.slice(0, 10) ?? new Date().toISOString().slice(0, 10), branchId: entry?.branchId ?? "", description: entry?.description ?? "", reference: entry?.reference ?? "", currencyCode: entry?.currencyCode ?? "SAR", exchangeRate: entry?.exchangeRate ?? 1 });
  const [lines, setLines] = React.useState<Line[]>(entry?.lines.map((l) => ({ accountId: l.accountId, costCenterId: l.costCenterId, description: l.description ?? "", debit: l.debit || "", credit: l.credit || "" })) ?? [emptyLine(), emptyLine()]);
  const [busy, setBusy] = React.useState<string | null>(null);

  const totalDebit = lines.reduce((a, l) => a + Number(l.debit || 0), 0);
  const totalCredit = lines.reduce((a, l) => a + Number(l.credit || 0), 0);
  const balanced = Math.abs(totalDebit - totalCredit) < 0.005 && totalDebit > 0;

  const update = (i: number, patch: Partial<Line>) => setLines((p) => p.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const fail = (err: string) => toast.error(te.has(err) ? te(err) : err);

  const save = async () => {
    setBusy("save");
    const res = await saveJournalAction({ id: entry?.id ?? null, ...head, branchId: head.branchId || null, lines: lines.filter((l) => l.accountId).map((l) => ({ ...l, debit: Number(l.debit || 0), credit: Number(l.credit || 0) })) });
    setBusy(null);
    if (res.ok) {
      toast.success(tc("saved"));
      const d = res.data as { id: string };
      if (!entry) router.replace(`/${locale}/finance/journals/${d.id}`);
      else router.refresh();
    } else fail(res.fieldErrors ? Object.entries(res.fieldErrors).map(([k, v]) => `${k}: ${v[0]}`).join("; ") : res.error);
  };
  const post = async () => {
    if (!entry) return;
    setBusy("post");
    const res = await postJournalAction(entry.id);
    setBusy(null);
    if (res.ok) {
      toast.success((res.data as { status: string }).status === "POSTED" ? t("posted") : t("sentForApproval"));
      router.refresh();
    } else fail(res.error);
  };

  return (
    <>
      <PageHeader
        title={entry ? `${t("journalEntry")} ${entry.number}` : t("journals.new")}
        description={entry ? `${t("source")}: ${entry.source}` : undefined}
        actions={
          <>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/finance/journals">
                <ArrowLeft className="rtl:rotate-180" /> {tc("back")}
              </Link>
            </Button>
            {entry && <DocStatus status={entry.status} />}
            {entry && <PdfButtons doc="journal" id={entry.id} />}
          </>
        }
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-3 space-y-4">
          <Card>
            <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <div className="space-y-1">
                <Label>{tf("date")}</Label>
                <Input type="date" dir="ltr" value={head.entryDate} disabled={!editable} onChange={(e) => setHead({ ...head, entryDate: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>{tf("branch")}</Label>
                <Combobox options={lookups.branches} value={head.branchId} disabled={!editable} onChange={(v) => setHead({ ...head, branchId: v ?? "" })} />
              </div>
              <div className="space-y-1">
                <Label>{tf("currency")}</Label>
                <Select value={head.currencyCode} disabled={!editable} onValueChange={(v) => setHead({ ...head, currencyCode: v, exchangeRate: v === "SAR" ? 1 : head.exchangeRate })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{lookups.currencies.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>{t("exchangeRate")}</Label>
                <Input type="number" step="0.000001" dir="ltr" value={head.exchangeRate} disabled={!editable || head.currencyCode === "SAR"} onChange={(e) => setHead({ ...head, exchangeRate: Number(e.target.value) })} />
              </div>
              <div className="space-y-1">
                <Label>{t("reference")}</Label>
                <Input value={head.reference} disabled={!editable} onChange={(e) => setHead({ ...head, reference: e.target.value })} />
              </div>
              <div className="space-y-1 sm:col-span-2 lg:col-span-5">
                <Label>{tf("description")}</Label>
                <Input value={head.description} disabled={!editable} onChange={(e) => setHead({ ...head, description: e.target.value })} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8">#</TableHead>
                    <TableHead className="min-w-[260px]">{t("account")}</TableHead>
                    <TableHead className="min-w-[160px]">{tf("costCenter")}</TableHead>
                    <TableHead className="min-w-[200px]">{tf("description")}</TableHead>
                    <TableHead className="w-36 text-end">{t("debit")}</TableHead>
                    <TableHead className="w-36 text-end">{t("credit")}</TableHead>
                    {editable && <TableHead className="w-10" />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lines.map((l, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                      <TableCell><Combobox size="sm" options={lookups.accounts} value={l.accountId} disabled={!editable} onChange={(v) => update(i, { accountId: v ?? "" })} allowClear={false} /></TableCell>
                      <TableCell><Combobox size="sm" options={lookups.costCenters} value={l.costCenterId} disabled={!editable} onChange={(v) => update(i, { costCenterId: v })} /></TableCell>
                      <TableCell><Input className="h-8" value={l.description} disabled={!editable} onChange={(e) => update(i, { description: e.target.value })} /></TableCell>
                      <TableCell><Input className="h-8 text-end" type="number" step="0.01" min="0" dir="ltr" value={l.debit} disabled={!editable} onChange={(e) => update(i, { debit: e.target.value, credit: e.target.value ? "" : l.credit })} /></TableCell>
                      <TableCell><Input className="h-8 text-end" type="number" step="0.01" min="0" dir="ltr" value={l.credit} disabled={!editable} onChange={(e) => update(i, { credit: e.target.value, debit: e.target.value ? "" : l.debit })} /></TableCell>
                      {editable && (
                        <TableCell>
                          <Button type="button" variant="ghost" size="icon-sm" onClick={() => setLines((p) => p.filter((_, j) => j !== i))} disabled={lines.length <= 2}>
                            <Trash2 className="size-3.5" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                  <TableRow className="font-semibold bg-muted/30">
                    <TableCell colSpan={4} className="text-end">{tc("total")}</TableCell>
                    <TableCell className="text-end tabular-nums" dir="ltr">{formatMoney(totalDebit, locale, head.currencyCode)}</TableCell>
                    <TableCell className="text-end tabular-nums" dir="ltr">{formatMoney(totalCredit, locale, head.currencyCode)}</TableCell>
                    {editable && <TableCell />}
                  </TableRow>
                  {!balanced && totalDebit + totalCredit > 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-destructive text-sm">{t("unbalanced")}: <span dir="ltr">{formatMoney(totalDebit - totalCredit, locale, head.currencyCode)}</span></TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
              {editable && (
                <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => setLines((p) => [...p, emptyLine()])}>
                  <Plus /> {t("addLine")}
                </Button>
              )}
            </CardContent>
          </Card>

          <div className="flex flex-wrap items-center gap-2">
            {editable && (can.create || can.edit) && (
              <Button onClick={save} disabled={busy !== null || !balanced}>
                {busy === "save" ? <Loader2 className="animate-spin" /> : <Save />} {tc("save")}
              </Button>
            )}
            {entry && (entry.status === "DRAFT" || entry.status === "APPROVED") && can.edit && (
              <Button variant="secondary" onClick={post} disabled={busy !== null}>
                {busy === "post" ? <Loader2 className="animate-spin" /> : <Send />} {t("post")}
              </Button>
            )}
            {entry && entry.status === "POSTED" && can.approve && (
              <ConfirmButton title={t("reverseConfirm")} action={() => reverseJournalAction({ id: entry.id })} variant="outline" onSuccess={(d) => router.push(`/${locale}/finance/journals/${(d as { id: string }).id}`)}>
                <Undo2 /> {t("reverse")}
              </ConfirmButton>
            )}
            {entry && entry.status === "DRAFT" && can.delete && (
              <ConfirmButton title={tc("deleteConfirmTitle")} action={() => deleteJournalAction(entry.id)} variant="ghost" onSuccess={() => router.push(`/${locale}/finance/journals`)}>
                <Trash2 className="text-destructive" /> <span className="text-destructive">{tc("delete")}</span>
              </ConfirmButton>
            )}
            {entry?.reversalOfId && (
              <Link href={`/finance/journals/${entry.reversalOfId}`} className="text-sm text-primary hover:underline">
                {t("reversalOf")}
              </Link>
            )}
          </div>
          {entry && <AttachmentsPanel entityType="JournalEntry" entityId={entry.id} items={attachments} canUpload={canAttach.upload} canDelete={canAttach.delete} />}
        </div>
      </div>
    </>
  );
}
