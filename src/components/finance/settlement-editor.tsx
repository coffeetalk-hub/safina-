"use client";

import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Save, Send, Trash2, Undo2, Wand2 } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Combobox } from "@/components/ui/combobox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { ConfirmButton } from "@/components/forms/confirm-button";
import { AttachmentsPanel, type AttachmentItem } from "@/components/attachments/attachments-panel";
import { DocStatus, PdfButtons, JournalLink } from "@/components/finance/doc-toolbar";
import { PageHeader } from "@/components/shell/page-header";
import type { FinanceLookups } from "@/modules/finance/_shared/lookups";
import type { ActionResult } from "@/core/action";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/dates";

export type OpenDoc = { id: string; number: string; date: string; dueDate: string; total: number; outstanding: number; allocated: number; ref?: string | null };
export type SettlementData = { id: string; number: string; partyId: string; branchId: string | null; date: string; method: string; bankAccountId: string | null; currencyCode: string; exchangeRate: number; amount: number; reference: string | null; notes: string | null; status: string; journalEntryId: string | null; allocations: { docId: string; amount: number }[] };

type Actions = { save: (input: unknown) => Promise<ActionResult>; post: (id: string) => Promise<ActionResult>; reverse: (id: string) => Promise<ActionResult>; remove: (id: string) => Promise<ActionResult>; loadOpen: (partyId: string, id?: string) => Promise<ActionResult> };

/** Shared editor for customer receipts (mode "AR") and vendor payments (mode "AP"). */
export function SettlementEditor({ mode, doc, lookups, can, actions, attachments, canAttach, pdfDoc, listHref, initialOpen, initialParty }: { mode: "AR" | "AP"; doc: SettlementData | null; lookups: FinanceLookups; can: { create: boolean; edit: boolean; delete: boolean; approve: boolean }; actions: Actions; attachments: AttachmentItem[]; canAttach: { upload: boolean; delete: boolean }; pdfDoc: string; listHref: string; initialOpen: OpenDoc[]; initialParty?: string | null }) {
  const t = useTranslations("finance");
  const tf = useTranslations("fields");
  const tc = useTranslations("common");
  const te = useTranslations("errors");
  const tm = useTranslations("enums.PaymentMethod");
  const locale = useLocale();
  const toast = useToast();
  const router = useRouter();
  const editable = !doc || doc.status === "DRAFT";
  const parties = mode === "AR" ? lookups.customers : lookups.vendors;
  const [head, setHead] = React.useState({ partyId: doc?.partyId ?? initialParty ?? "", branchId: doc?.branchId ?? "", date: doc?.date.slice(0, 10) ?? new Date().toISOString().slice(0, 10), method: doc?.method ?? "BANK_TRANSFER", bankAccountId: doc?.bankAccountId ?? lookups.bankAccounts[0]?.value ?? "", currencyCode: doc?.currencyCode ?? "SAR", exchangeRate: doc?.exchangeRate ?? 1, amount: doc?.amount ?? ("" as number | string), reference: doc?.reference ?? "", notes: doc?.notes ?? "" });
  const [open, setOpen] = React.useState<OpenDoc[]>(initialOpen);
  const [alloc, setAlloc] = React.useState<Record<string, number | string>>(Object.fromEntries((doc?.allocations ?? []).map((a) => [a.docId, a.amount])));
  const [busy, setBusy] = React.useState<string | null>(null);
  const allocated = Object.values(alloc).reduce<number>((a, v) => a + Number(v || 0), 0);
  const amount = Number(head.amount || 0);
  const fail = (err: string) => toast.error(te.has(err) ? te(err) : err);

  const onParty = async (id: string | null) => {
    setHead((h) => ({ ...h, partyId: id ?? "" }));
    setAlloc({});
    if (!id) return setOpen([]);
    const res = await actions.loadOpen(id, doc?.id);
    if (res.ok) {
      const rows = res.data as Record<string, unknown>[];
      setOpen(rows.map((r) => ({ id: String(r.id), number: String(r.number), date: String(r.invoiceDate ?? r.billDate), dueDate: String(r.dueDate), total: Number(r.total), outstanding: Number(r.outstanding), allocated: Number(r.allocated), ref: (r.vendorInvoiceNumber as string | null) ?? null })));
    }
  };
  const autoAllocate = () => {
    let left = amount;
    const next: Record<string, number> = {};
    for (const o of open) {
      if (left <= 0) break;
      const a = Math.min(left, o.outstanding);
      if (a > 0) next[o.id] = Math.round(a * 100) / 100;
      left -= a;
    }
    setAlloc(next);
  };
  const save = async () => {
    setBusy("save");
    const res = await actions.save({
      id: doc?.id ?? null,
      [mode === "AR" ? "customerId" : "vendorId"]: head.partyId,
      branchId: head.branchId || null,
      [mode === "AR" ? "receiptDate" : "paymentDate"]: head.date,
      method: head.method,
      bankAccountId: head.method === "CASH" ? null : head.bankAccountId || null,
      currencyCode: head.currencyCode,
      exchangeRate: Number(head.exchangeRate) || 1,
      amount,
      reference: head.reference || null,
      notes: head.notes || null,
      allocations: Object.entries(alloc).filter(([, v]) => Number(v) > 0).map(([id, v]) => ({ [mode === "AR" ? "invoiceId" : "billId"]: id, amount: Number(v) })),
    });
    setBusy(null);
    if (res.ok) {
      toast.success(tc("saved"));
      const d = res.data as { id: string };
      if (!doc) router.replace(`/${locale}${listHref}/${d.id}`);
      else router.refresh();
    } else fail(res.fieldErrors ? Object.entries(res.fieldErrors).map(([k, v]) => `${k}: ${v[0]}`).join("; ") : res.error);
  };
  const post = async () => {
    if (!doc) return;
    setBusy("post");
    const res = await actions.post(doc.id);
    setBusy(null);
    if (res.ok) {
      toast.success((res.data as { status: string }).status === "POSTED" ? t("posted") : t("sentForApproval"));
      router.refresh();
    } else fail(res.error);
  };

  return (
    <>
      <PageHeader
        title={doc ? `${mode === "AR" ? t("receipt") : t("payment")} ${doc.number}` : mode === "AR" ? t("receipts.new") : t("payments.new")}
        actions={<><Button variant="ghost" size="sm" asChild><Link href={listHref}><ArrowLeft className="rtl:rotate-180" /> {tc("back")}</Link></Button>{doc && <DocStatus status={doc.status} />}{doc && doc.status !== "DRAFT" && <PdfButtons doc={pdfDoc} id={doc.id} />}</>}
      />
      <div className="space-y-4">
        <Card>
          <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1 lg:col-span-2"><Label>{mode === "AR" ? t("customer") : t("vendor")} *</Label><Combobox options={parties} value={head.partyId} disabled={!editable} onChange={onParty} allowClear={false} /></div>
            <div className="space-y-1"><Label>{tf("date")} *</Label><Input type="date" dir="ltr" value={head.date} disabled={!editable} onChange={(e) => setHead({ ...head, date: e.target.value })} /></div>
            <div className="space-y-1"><Label>{tf("amount")} *</Label><Input type="number" step="0.01" min="0" dir="ltr" value={head.amount} disabled={!editable} onChange={(e) => setHead({ ...head, amount: e.target.value })} /></div>
            <div className="space-y-1">
              <Label>{t("method")}</Label>
              <Select value={head.method} disabled={!editable} onValueChange={(v) => setHead({ ...head, method: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{["CASH", "BANK_TRANSFER", "CHEQUE", "CARD", "OTHER"].map((m) => <SelectItem key={m} value={m}>{tm(m)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {head.method !== "CASH" && <div className="space-y-1"><Label>{t("bankAccount")}</Label><Combobox options={lookups.bankAccounts} value={head.bankAccountId} disabled={!editable} onChange={(v) => setHead({ ...head, bankAccountId: v ?? "" })} /></div>}
            <div className="space-y-1">
              <Label>{tf("currency")}</Label>
              <Select value={head.currencyCode} disabled={!editable} onValueChange={(v) => setHead({ ...head, currencyCode: v, exchangeRate: v === "SAR" ? 1 : head.exchangeRate })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{lookups.currencies.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>{t("exchangeRate")}</Label><Input type="number" step="0.000001" dir="ltr" value={head.exchangeRate} disabled={!editable || head.currencyCode === "SAR"} onChange={(e) => setHead({ ...head, exchangeRate: Number(e.target.value) })} /></div>
            <div className="space-y-1"><Label>{t("reference")}</Label><Input value={head.reference} disabled={!editable} onChange={(e) => setHead({ ...head, reference: e.target.value })} /></div>
            <div className="space-y-1"><Label>{tf("branch")}</Label><Combobox options={lookups.branches} value={head.branchId} disabled={!editable} onChange={(v) => setHead({ ...head, branchId: v ?? "" })} /></div>
            <div className="space-y-1 sm:col-span-2 lg:col-span-4"><Label>{tc("notes")}</Label><Textarea value={head.notes} disabled={!editable} onChange={(e) => setHead({ ...head, notes: e.target.value })} /></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-base">{t("allocations")}</CardTitle>
            {editable && <Button size="sm" variant="outline" onClick={autoAllocate} disabled={amount <= 0}><Wand2 /> {t("autoAllocate")}</Button>}
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{tf("number")}</TableHead>
                  {mode === "AP" && <TableHead>{t("vendorInvoiceNumber")}</TableHead>}
                  <TableHead>{tf("date")}</TableHead>
                  <TableHead>{t("dueDate")}</TableHead>
                  <TableHead className="text-end">{t("total")}</TableHead>
                  <TableHead className="text-end">{t("outstanding")}</TableHead>
                  <TableHead className="text-end w-36">{t("allocate")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {open.length === 0 && <TableRow><TableCell colSpan={7} className="h-16 text-center text-muted-foreground">{t("noOpenDocs")}</TableCell></TableRow>}
                {open.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell dir="ltr"><Link href={`${mode === "AR" ? "/finance/ar/invoices" : "/finance/ap/bills"}/${o.id}`} className="text-primary hover:underline">{o.number}</Link></TableCell>
                    {mode === "AP" && <TableCell dir="ltr">{o.ref ?? ""}</TableCell>}
                    <TableCell dir="ltr">{formatDate(o.date, locale)}</TableCell>
                    <TableCell dir="ltr">{formatDate(o.dueDate, locale)}</TableCell>
                    <TableCell className="text-end tabular-nums" dir="ltr">{formatMoney(o.total, locale, head.currencyCode)}</TableCell>
                    <TableCell className="text-end tabular-nums" dir="ltr">{formatMoney(o.outstanding, locale, head.currencyCode)}</TableCell>
                    <TableCell><Input className="h-8 text-end" type="number" step="0.01" min="0" max={o.outstanding} dir="ltr" value={alloc[o.id] ?? ""} disabled={!editable} onChange={(e) => setAlloc({ ...alloc, [o.id]: e.target.value })} /></TableCell>
                  </TableRow>
                ))}
                <TableRow className="font-semibold bg-muted/30">
                  <TableCell colSpan={mode === "AP" ? 6 : 5} className="text-end">{t("allocated")} / {t("unallocated")}</TableCell>
                  <TableCell className="text-end tabular-nums" dir="ltr">{formatMoney(allocated, locale, head.currencyCode)} / {formatMoney(amount - allocated, locale, head.currencyCode)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
            {allocated > amount + 0.005 && <p className="text-destructive text-sm mt-2">{te("ALLOCATION_EXCEEDS_AMOUNT")}</p>}
          </CardContent>
        </Card>

        <div className="flex flex-wrap items-center gap-2">
          {editable && (can.create || can.edit) && <Button onClick={save} disabled={busy !== null || !head.partyId || amount <= 0 || allocated > amount + 0.005}>{busy === "save" ? <Loader2 className="animate-spin" /> : <Save />} {tc("save")}</Button>}
          {doc && (doc.status === "DRAFT" || doc.status === "APPROVED") && can.edit && <Button variant="secondary" onClick={post} disabled={busy !== null}>{busy === "post" ? <Loader2 className="animate-spin" /> : <Send />} {t("post")}</Button>}
          {doc && doc.status === "POSTED" && can.approve && <ConfirmButton title={t("reverseConfirm")} action={() => actions.reverse(doc.id)} variant="outline"><Undo2 /> {t("reverse")}</ConfirmButton>}
          {doc && doc.status === "DRAFT" && can.delete && <ConfirmButton title={tc("deleteConfirmTitle")} action={() => actions.remove(doc.id)} variant="ghost" onSuccess={() => router.push(`/${locale}${listHref}`)}><Trash2 className="text-destructive" /> <span className="text-destructive">{tc("delete")}</span></ConfirmButton>}
          {doc && <JournalLink id={doc.journalEntryId} />}
        </div>
        {doc && <AttachmentsPanel entityType={mode === "AR" ? "Receipt" : "Payment"} entityId={doc.id} items={attachments} canUpload={canAttach.upload} canDelete={canAttach.delete} />}
      </div>
    </>
  );
}
