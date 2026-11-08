"use client";

import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { ArrowLeft, Award, Ban, Loader2, Plus, Save, Send, Trash2, Undo2, FileEdit } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Combobox } from "@/components/ui/combobox";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { ConfirmButton } from "@/components/forms/confirm-button";
import { AttachmentsPanel, type AttachmentItem } from "@/components/attachments/attachments-panel";
import { DocStatus } from "@/components/finance/doc-toolbar";
import { PageHeader } from "@/components/shell/page-header";
import type { FinanceLookups } from "@/modules/finance/_shared/lookups";
import { awardRfqAction, rfqStatusAction, saveQuoteAction, saveRfqAction } from "@/modules/purchasing/actions";
import { formatMoney, formatNumber } from "@/lib/money";
import { formatDate } from "@/lib/dates";

type Line = { id?: string | null; itemId: string | null; descriptionAr: string; descriptionEn: string; quantity: number | string; unit: string };
type QuoteLine = { rfqLineId: string; unitPrice: number; notes: string | null };
type Quote = { id: string; vendorId: string; vendor: { id: string; code: string; nameAr: string; nameEn: string }; received: boolean; selected: boolean; quoteRef: string | null; quoteDate: string | null; validUntil: string | null; leadDays: number | null; paymentTerms: string | null; currencyCode: string; notes: string | null; total: number; lines: QuoteLine[] };
export type RfqDoc = { id: string; number: string; status: string; titleAr: string; titleEn: string; requestId: string | null; branchId: string | null; issueDate: string; dueDate: string; notes: string | null; awardedVendorId: string | null; purchaseOrderId: string | null; lines: (Line & { id: string })[]; quotes: Quote[]; request: { id: string; number: string } | null };
export type Comparison = { rows: { lineId: string; lineNo: number; descriptionAr: string; descriptionEn: string; quantity: number; unit: string; prices: { vendorId: string; unitPrice: number | null; total: number | null }[]; min: number | null }[]; totals: { vendorId: string; vendor: { nameAr: string; nameEn: string; code: string }; total: number; leadDays: number | null; paymentTerms: string | null; validUntil: string | null; quoteRef: string | null; selected: boolean; lowestLines: number; rank: number | null }[] };

const emptyLine = (): Line => ({ id: null, itemId: null, descriptionAr: "", descriptionEn: "", quantity: 1, unit: "EA" });

export function RfqEditor({ doc, comparison, lookups, can, canAward, attachments, canAttach }: { doc: RfqDoc | null; comparison: Comparison | null; lookups: FinanceLookups; can: { create: boolean; edit: boolean; delete: boolean }; canAward: boolean; attachments: AttachmentItem[]; canAttach: { upload: boolean; delete: boolean } }) {
  const t = useTranslations("purchasing");
  const tf = useTranslations("fields");
  const tc = useTranslations("common");
  const te = useTranslations("errors");
  const tfin = useTranslations("finance");
  const locale = useLocale();
  const ar = locale === "ar";
  const toast = useToast();
  const router = useRouter();
  const editable = !doc || doc.status === "DRAFT" || doc.status === "SENT";
  const open = !!doc && doc.status !== "AWARDED" && doc.status !== "CANCELLED";
  const today = new Date().toISOString().slice(0, 10);
  const defaultDue = React.useMemo(() => { const d = new Date(); d.setUTCDate(d.getUTCDate() + 7); return d.toISOString().slice(0, 10); }, []);
  const items = React.useMemo(() => lookups.items.filter((i) => i.meta?.purchasable), [lookups.items]);

  const [head, setHead] = React.useState({ titleAr: doc?.titleAr ?? "", titleEn: doc?.titleEn ?? "", branchId: doc?.branchId ?? "", issueDate: doc?.issueDate.slice(0, 10) ?? today, dueDate: doc?.dueDate.slice(0, 10) ?? defaultDue, notes: doc?.notes ?? "" });
  const [lines, setLines] = React.useState<Line[]>(doc?.lines.map((l) => ({ ...l })) ?? [emptyLine()]);
  const [vendorIds, setVendorIds] = React.useState<string[]>(doc?.quotes.map((q) => q.vendorId) ?? []);
  const [vendorQ, setVendorQ] = React.useState("");
  const [busy, setBusy] = React.useState<string | null>(null);
  const [quote, setQuote] = React.useState<{ vendorId: string; quoteRef: string; quoteDate: string; validUntil: string; leadDays: string; paymentTerms: string; currencyCode: string; notes: string; prices: Record<string, string> } | null>(null);

  const upd = (i: number, patch: Partial<Line>) => setLines((p) => p.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const onItem = (i: number, id: string | null) => { const m = items.find((x) => x.value === id)?.meta ?? {}; upd(i, { itemId: id, descriptionAr: String(m.nameAr ?? lines[i].descriptionAr), descriptionEn: String(m.nameEn ?? lines[i].descriptionEn), unit: String(m.unit ?? lines[i].unit) }); };
  const fail = (err: string) => toast.error(te.has(err) ? te(err) : err);

  const save = async () => {
    setBusy("save");
    const res = await saveRfqAction({ id: doc?.id ?? null, ...head, requestId: doc?.requestId ?? null, branchId: head.branchId || null, notes: head.notes || null, vendorIds, lines: lines.filter((l) => l.descriptionAr || l.descriptionEn).map((l) => ({ ...l, descriptionAr: l.descriptionAr || l.descriptionEn, descriptionEn: l.descriptionEn || l.descriptionAr, quantity: Number(l.quantity || 0) })) });
    setBusy(null);
    if (res.ok) { toast.success(tc("saved")); const d = res.data as { id: string }; if (!doc) router.replace(`/${locale}/purchasing/rfq/${d.id}`); else router.refresh(); }
    else fail(res.fieldErrors ? Object.entries(res.fieldErrors).map(([k, v]) => `${k}: ${v[0]}`).join("; ") : res.error);
  };
  const openQuote = (q: Quote) => setQuote({ vendorId: q.vendorId, quoteRef: q.quoteRef ?? "", quoteDate: q.quoteDate?.slice(0, 10) ?? today, validUntil: q.validUntil?.slice(0, 10) ?? "", leadDays: q.leadDays?.toString() ?? "", paymentTerms: q.paymentTerms ?? "", currencyCode: q.currencyCode, notes: q.notes ?? "", prices: Object.fromEntries((doc?.lines ?? []).map((l) => [l.id, String(q.lines.find((x) => x.rfqLineId === l.id)?.unitPrice ?? "")])) });
  const saveQuote = async () => {
    if (!doc || !quote) return;
    setBusy("quote");
    const res = await saveQuoteAction({ rfqId: doc.id, vendorId: quote.vendorId, quoteRef: quote.quoteRef || null, quoteDate: quote.quoteDate || null, validUntil: quote.validUntil || null, leadDays: quote.leadDays === "" ? null : Number(quote.leadDays), paymentTerms: quote.paymentTerms || null, currencyCode: quote.currencyCode, notes: quote.notes || null, lines: doc.lines.map((l) => ({ rfqLineId: l.id, unitPrice: Number(quote.prices[l.id] || 0), notes: null })) });
    setBusy(null);
    if (res.ok) { toast.success(tc("saved")); setQuote(null); router.refresh(); } else fail(res.error);
  };
  const vendors = lookups.vendors.filter((v) => !vendorQ || v.label.toLowerCase().includes(vendorQ.toLowerCase()));
  const vname = (v: { nameAr: string; nameEn: string }) => (ar ? v.nameAr : v.nameEn);
  const quoteTotal = quote && doc ? doc.lines.reduce((a, l) => a + Number(quote.prices[l.id] || 0) * Number(l.quantity), 0) : 0;
  const title = doc ? `${t("rfq.one")} ${doc.number}` : t("rfq.new");

  return (
    <>
      <PageHeader title={title} description={doc ? (ar ? doc.titleAr : doc.titleEn) : undefined} actions={<><Button variant="ghost" size="sm" asChild><Link href="/purchasing/rfq"><ArrowLeft className="rtl:rotate-180" /> {tc("back")}</Link></Button>{doc && <DocStatus status={doc.status} />}</>} />
      <div className="space-y-4">
        <Card>
          <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1 lg:col-span-2"><Label>{tf("titleAr")} *</Label><Input dir="rtl" value={head.titleAr} disabled={!editable} onChange={(e) => setHead({ ...head, titleAr: e.target.value })} /></div>
            <div className="space-y-1 lg:col-span-2"><Label>{tf("titleEn")} *</Label><Input dir="ltr" value={head.titleEn} disabled={!editable} onChange={(e) => setHead({ ...head, titleEn: e.target.value })} /></div>
            <div className="space-y-1"><Label>{tf("date")} *</Label><Input type="date" dir="ltr" value={head.issueDate} disabled={!editable} onChange={(e) => setHead({ ...head, issueDate: e.target.value })} /></div>
            <div className="space-y-1"><Label>{t("quotesDue")} *</Label><Input type="date" dir="ltr" value={head.dueDate} disabled={!editable} onChange={(e) => setHead({ ...head, dueDate: e.target.value })} /></div>
            <div className="space-y-1"><Label>{tf("branch")}</Label><Combobox options={lookups.branches} value={head.branchId} disabled={!editable} onChange={(v) => setHead({ ...head, branchId: v ?? "" })} /></div>
            {doc?.request && <div className="space-y-1"><Label>{t("request")}</Label><div className="text-sm pt-2"><Link href={`/purchasing/requests/${doc.request.id}`} className="text-primary hover:underline" dir="ltr">{doc.request.number}</Link></div></div>}
          </CardContent>
        </Card>
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2"><CardContent>
            <Table>
              <TableHeader><TableRow><TableHead className="w-8">#</TableHead><TableHead className="min-w-[180px]">{tfin("item")}</TableHead><TableHead className="min-w-[200px]">{tf("description")}</TableHead><TableHead className="w-24 text-end">{tfin("qty")}</TableHead><TableHead className="w-20">{tf("unit")}</TableHead>{editable && <TableHead className="w-10" />}</TableRow></TableHeader>
              <TableBody>
                {lines.map((l, i) => (
                  <TableRow key={i}>
                    <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                    <TableCell><Combobox size="sm" options={items} value={l.itemId} disabled={!editable} onChange={(v) => onItem(i, v)} /></TableCell>
                    <TableCell className="space-y-1">
                      <Input className="h-8" dir="rtl" placeholder={tf("descriptionAr")} value={l.descriptionAr} disabled={!editable} onChange={(e) => upd(i, { descriptionAr: e.target.value })} />
                      <Input className="h-8" dir="ltr" placeholder={tf("descriptionEn")} value={l.descriptionEn} disabled={!editable} onChange={(e) => upd(i, { descriptionEn: e.target.value })} />
                    </TableCell>
                    <TableCell><Input className="h-8 text-end" type="number" step="0.01" min="0" dir="ltr" value={l.quantity} disabled={!editable} onChange={(e) => upd(i, { quantity: e.target.value })} /></TableCell>
                    <TableCell><Input className="h-8" dir="ltr" value={l.unit} disabled={!editable} onChange={(e) => upd(i, { unit: e.target.value })} /></TableCell>
                    {editable && <TableCell><Button type="button" variant="ghost" size="icon-sm" onClick={() => setLines((p) => p.filter((_, j) => j !== i))} disabled={lines.length <= 1}><Trash2 className="size-3.5" /></Button></TableCell>}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {editable && <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => setLines((p) => [...p, emptyLine()])}><Plus /> {tfin("addLine")}</Button>}
            <div className="space-y-1 mt-4"><Label>{tc("notes")}</Label><Textarea value={head.notes} disabled={!editable} onChange={(e) => setHead({ ...head, notes: e.target.value })} /></div>
          </CardContent></Card>
          <Card>
            <CardHeader><CardTitle className="text-base">{t("vendorsInvited")} ({vendorIds.length})</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {editable && <Input placeholder={tc("search")} value={vendorQ} onChange={(e) => setVendorQ(e.target.value)} />}
              <div className="max-h-72 overflow-y-auto space-y-1" data-testid="vendor-list">
                {(editable ? vendors : lookups.vendors.filter((v) => vendorIds.includes(v.value))).map((v) => (
                  <label key={v.value} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox checked={vendorIds.includes(v.value)} disabled={!editable || (doc?.quotes.find((q) => q.vendorId === v.value)?.received ?? false)} onCheckedChange={(c) => setVendorIds((p) => (c ? [...p, v.value] : p.filter((x) => x !== v.value)))} /> {v.label}
                  </label>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {editable && (can.create || can.edit) && <Button onClick={save} disabled={busy !== null || vendorIds.length === 0 || !head.titleAr || !head.titleEn}>{busy === "save" ? <Loader2 className="animate-spin" /> : <Save />} {tc("save")}</Button>}
          {doc && doc.status === "DRAFT" && can.edit && <ConfirmButton title={t("rfq.send")} description={t("rfq.sendHint")} action={() => rfqStatusAction({ id: doc.id, status: "SENT" })} variant="secondary"><Send /> {t("rfq.send")}</ConfirmButton>}
          {doc && doc.status === "CANCELLED" && can.edit && <ConfirmButton title={t("rfq.reopen")} action={() => rfqStatusAction({ id: doc.id, status: "DRAFT" })} variant="outline"><Undo2 /> {t("rfq.reopen")}</ConfirmButton>}
          {doc && open && can.edit && <ConfirmButton title={tfin("cancelConfirm")} action={() => rfqStatusAction({ id: doc.id, status: "CANCELLED" })} variant="ghost"><Ban /> {tfin("cancelDoc")}</ConfirmButton>}
          {doc?.purchaseOrderId && <Button variant="outline" asChild><Link href={`/purchasing/orders/${doc.purchaseOrderId}`}>{t("purchaseOrder")} →</Link></Button>}
        </div>

        {doc && doc.quotes.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-base">{t("rfq.quotes")}</CardTitle></CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {doc.quotes.map((q) => (
                <div key={q.id} className={`rounded-md border p-3 text-sm space-y-1 ${q.selected ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-950/30" : ""}`}>
                  <div className="flex items-center justify-between gap-2"><span className="font-medium">{vname(q.vendor)}</span>{q.received ? <Badge variant="success">{t("rfq.received")}</Badge> : <Badge variant="secondary">{t("rfq.awaiting")}</Badge>}</div>
                  {q.received && <div className="text-muted-foreground" dir="ltr">{formatMoney(q.total, locale, q.currencyCode)}{q.leadDays != null ? ` · ${q.leadDays} ${t("days")}` : ""}{q.validUntil ? ` · ${formatDate(q.validUntil, locale)}` : ""}</div>}
                  {q.quoteRef && <div className="text-muted-foreground" dir="ltr">{q.quoteRef}</div>}
                  {open && can.edit && <Button size="sm" variant="outline" onClick={() => openQuote(q)}><FileEdit /> {q.received ? t("rfq.editQuote") : t("rfq.enterQuote")}</Button>}
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {doc && comparison && comparison.totals.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-base">{t("rfq.comparison")}</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8">#</TableHead><TableHead className="min-w-[200px]">{tf("description")}</TableHead><TableHead className="w-20 text-end">{tfin("qty")}</TableHead>
                    {comparison.totals.map((v) => <TableHead key={v.vendorId} className="text-end min-w-[140px]">{vname(v.vendor)}{v.rank === 1 && <Badge variant="success" className="ms-1">#1</Badge>}</TableHead>)}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {comparison.rows.map((r) => (
                    <TableRow key={r.lineId}>
                      <TableCell className="text-muted-foreground">{r.lineNo}</TableCell>
                      <TableCell>{ar ? r.descriptionAr : r.descriptionEn}</TableCell>
                      <TableCell className="text-end tabular-nums" dir="ltr">{formatNumber(r.quantity, locale)} {r.unit}</TableCell>
                      {comparison.totals.map((v) => { const p = r.prices.find((x) => x.vendorId === v.vendorId); const best = p?.unitPrice != null && p.unitPrice > 0 && p.unitPrice === r.min; return <TableCell key={v.vendorId} className={`text-end tabular-nums ${best ? "bg-emerald-50 dark:bg-emerald-950/30 font-semibold" : ""}`} dir="ltr">{p?.unitPrice != null && p.unitPrice > 0 ? <>{formatMoney(p.unitPrice, locale)}<div className="text-xs text-muted-foreground">{formatMoney(p.total ?? 0, locale)}</div></> : "—"}</TableCell>; })}
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow><TableCell colSpan={3}>{tfin("total")}</TableCell>{comparison.totals.map((v) => <TableCell key={v.vendorId} className="text-end tabular-nums font-semibold" dir="ltr">{formatMoney(v.total, locale)}</TableCell>)}</TableRow>
                  <TableRow><TableCell colSpan={3}>{t("rfq.lowestLines")}</TableCell>{comparison.totals.map((v) => <TableCell key={v.vendorId} className="text-end" dir="ltr">{v.lowestLines} / {comparison.rows.length}</TableCell>)}</TableRow>
                  <TableRow><TableCell colSpan={3}>{t("leadDays")} · {t("paymentTerms")}</TableCell>{comparison.totals.map((v) => <TableCell key={v.vendorId} className="text-end text-xs" dir="ltr">{v.leadDays ?? "—"} · {v.paymentTerms ?? "—"}</TableCell>)}</TableRow>
                  {open && canAward && (
                    <TableRow><TableCell colSpan={3}>{t("rfq.award")}</TableCell>{comparison.totals.map((v) => <TableCell key={v.vendorId} className="text-end"><ConfirmButton title={t("rfq.awardConfirm", { vendor: vname(v.vendor) })} description={t("rfq.awardHint")} action={() => awardRfqAction({ rfqId: doc.id, vendorId: v.vendorId })} variant={v.rank === 1 ? "default" : "outline"} size="sm" onSuccess={(d) => router.push(`/${locale}/purchasing/orders/${(d as { id: string }).id}`)}><Award /> {t("rfq.award")}</ConfirmButton></TableCell>)}</TableRow>
                  )}
                  {doc.status === "AWARDED" && <TableRow><TableCell colSpan={3}>{t("rfq.awardedTo")}</TableCell>{comparison.totals.map((v) => <TableCell key={v.vendorId} className="text-end">{v.selected && <Badge variant="success"><Award className="size-3" /> {t("rfq.awarded")}</Badge>}</TableCell>)}</TableRow>}
                </TableFooter>
              </Table>
            </CardContent>
          </Card>
        )}
        {doc && <AttachmentsPanel entityType="Rfq" entityId={doc.id} items={attachments} canUpload={canAttach.upload} canDelete={canAttach.delete} />}
      </div>

      <Dialog open={!!quote} onOpenChange={(o) => !o && setQuote(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{t("rfq.enterQuote")} — {quote && vname(doc?.quotes.find((q) => q.vendorId === quote.vendorId)?.vendor ?? { nameAr: "", nameEn: "" })}</DialogTitle></DialogHeader>
          {quote && doc && (
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1"><Label>{t("quoteRef")}</Label><Input dir="ltr" value={quote.quoteRef} onChange={(e) => setQuote({ ...quote, quoteRef: e.target.value })} /></div>
                <div className="space-y-1"><Label>{t("quoteDate")}</Label><Input type="date" dir="ltr" value={quote.quoteDate} onChange={(e) => setQuote({ ...quote, quoteDate: e.target.value })} /></div>
                <div className="space-y-1"><Label>{tfin("validUntil")}</Label><Input type="date" dir="ltr" value={quote.validUntil} onChange={(e) => setQuote({ ...quote, validUntil: e.target.value })} /></div>
                <div className="space-y-1"><Label>{t("leadDays")}</Label><Input type="number" min="0" dir="ltr" value={quote.leadDays} onChange={(e) => setQuote({ ...quote, leadDays: e.target.value })} /></div>
                <div className="space-y-1"><Label>{t("paymentTerms")}</Label><Input value={quote.paymentTerms} onChange={(e) => setQuote({ ...quote, paymentTerms: e.target.value })} /></div>
                <div className="space-y-1"><Label>{tf("currency")}</Label><Combobox options={lookups.currencies} value={quote.currencyCode} allowClear={false} onChange={(v) => setQuote({ ...quote, currencyCode: v ?? "SAR" })} /></div>
              </div>
              <Table>
                <TableHeader><TableRow><TableHead>{tf("description")}</TableHead><TableHead className="w-24 text-end">{tfin("qty")}</TableHead><TableHead className="w-32 text-end">{tfin("unitPrice")}</TableHead><TableHead className="w-32 text-end">{tfin("total")}</TableHead></TableRow></TableHeader>
                <TableBody>
                  {doc.lines.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell>{ar ? l.descriptionAr : l.descriptionEn}</TableCell>
                      <TableCell className="text-end tabular-nums" dir="ltr">{formatNumber(Number(l.quantity), locale)} {l.unit}</TableCell>
                      <TableCell><Input className="h-8 text-end" type="number" step="0.01" min="0" dir="ltr" data-testid="quote-price" value={quote.prices[l.id] ?? ""} onChange={(e) => setQuote({ ...quote, prices: { ...quote.prices, [l.id]: e.target.value } })} /></TableCell>
                      <TableCell className="text-end tabular-nums" dir="ltr">{formatMoney(Number(quote.prices[l.id] || 0) * Number(l.quantity), locale, quote.currencyCode)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter><TableRow><TableCell colSpan={3}>{tfin("total")}</TableCell><TableCell className="text-end tabular-nums font-semibold" dir="ltr">{formatMoney(quoteTotal, locale, quote.currencyCode)}</TableCell></TableRow></TableFooter>
              </Table>
              <div className="space-y-1"><Label>{tc("notes")}</Label><Textarea value={quote.notes} onChange={(e) => setQuote({ ...quote, notes: e.target.value })} /></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setQuote(null)}>{tc("cancel")}</Button>
            <Button onClick={saveQuote} disabled={busy !== null}>{busy === "quote" ? <Loader2 className="animate-spin" /> : <Save />} {tc("save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
