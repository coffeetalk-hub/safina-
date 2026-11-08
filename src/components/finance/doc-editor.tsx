"use client";

import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { ArrowLeft, Ban, FileMinus, Loader2, Plus, Save, Send, ShieldCheck, Trash2, Undo2, Code2 } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
import { pickPrice, type PricingData } from "@/modules/sales/pricing-client";
import type { ActionResult } from "@/core/action";
import { formatMoney } from "@/lib/money";
import { formatDateTime } from "@/lib/dates";

export type DocLine = { itemId: string | null; descriptionAr: string; descriptionEn: string; quantity: number | string; unitPrice: number | string; discountPct: number | string; taxCodeId: string | null; accountId: string | null; costCenterId: string | null };
export type DocData = {
  id: string;
  number: string;
  partyId: string;
  branchId: string | null;
  docDate: string;
  dueDate: string;
  supplyDate?: string | null;
  currencyCode: string;
  exchangeRate: number;
  discountPct: number;
  reference: string | null;
  notes: string | null;
  status: string;
  type?: string;
  kind?: string;
  salespersonId?: string | null;
  vendorInvoiceNumber?: string | null;
  originalId?: string | null;
  journalEntryId: string | null;
  journalNumber?: string | null;
  paidAmount: number;
  total: number;
  lines: DocLine[];
  allocations: { id: string; number: string; date: string; amount: number }[];
  zatca?: { uuid: string; icv: number; invoiceHash: string; qrBase64: string; status: string; submittedAt: string | null; response: unknown } | null;
};

type Actions = {
  save: (input: unknown) => Promise<ActionResult>;
  post?: (input: unknown) => Promise<ActionResult>;
  cancel?: (id: string) => Promise<ActionResult>;
  reverse?: (id: string) => Promise<ActionResult>;
  creditNote?: (id: string) => Promise<ActionResult>;
  submitZatca?: (id: string) => Promise<ActionResult>;
};
/** Status transition buttons (quotations/orders). `when` lists statuses in which the button shows. */
export type Transition = { key: string; label: string; action: (id: string) => Promise<ActionResult>; variant?: "default" | "secondary" | "outline" | "ghost" | "destructive"; when: string[]; navigateTo?: string; confirm?: string };
export type LinkedDoc = { label: string; href: string; status?: string };
export type DocMode = "AR" | "AP" | "QUOTE" | "ORDER" | "PO";

const emptyLine = (): DocLine => ({ itemId: null, descriptionAr: "", descriptionEn: "", quantity: 1, unitPrice: "", discountPct: 0, taxCodeId: null, accountId: null, costCenterId: null });

/** Shared editor for customer invoices (mode "AR") and vendor bills (mode "AP"). */
export function DocEditor({ mode, doc, lookups, can, actions, attachments, canAttach, pdfDoc, listHref, initialParty, pricing, transitions = [], linkedDocs = [], postLabel, entityType, initialLines, extraPayload }: { mode: DocMode; doc: DocData | null; lookups: FinanceLookups; can: { create: boolean; edit: boolean; delete: boolean; approve: boolean }; actions: Actions; attachments: AttachmentItem[]; canAttach: { upload: boolean; delete: boolean }; pdfDoc: string; listHref: string; initialParty?: string | null; pricing?: PricingData; transitions?: Transition[]; linkedDocs?: LinkedDoc[]; postLabel?: string; entityType?: string; initialLines?: DocLine[]; extraPayload?: Record<string, unknown> }) {
  const t = useTranslations("finance");
  const tf = useTranslations("fields");
  const tc = useTranslations("common");
  const te = useTranslations("errors");
  const tk = useTranslations("enums");
  const locale = useLocale();
  const ar = locale === "ar";
  const toast = useToast();
  const router = useRouter();
  const editable = !doc || doc.status === "DRAFT";
  const sales = mode !== "AP" && mode !== "PO";
  const parties = sales ? lookups.customers : lookups.vendors;
  const accounts = React.useMemo(() => lookups.accounts.filter((a) => (sales ? a.meta?.type === "REVENUE" : a.meta?.type === "EXPENSE" || a.meta?.type === "ASSET")), [lookups.accounts, sales]);
  const items = React.useMemo(() => lookups.items.filter((i) => (sales ? i.meta?.sellable : i.meta?.purchasable)), [lookups.items, sales]);
  const defaultTax = lookups.taxCodes.find((x) => x.meta?.isDefault)?.value ?? null;
  const today = new Date().toISOString().slice(0, 10);

  const [head, setHead] = React.useState({
    partyId: doc?.partyId ?? initialParty ?? "",
    branchId: doc?.branchId ?? "",
    docDate: doc?.docDate.slice(0, 10) ?? today,
    dueDate: doc?.dueDate.slice(0, 10) ?? today,
    supplyDate: doc?.supplyDate?.slice(0, 10) ?? "",
    currencyCode: doc?.currencyCode ?? "SAR",
    exchangeRate: doc?.exchangeRate ?? 1,
    discountPct: doc?.discountPct ?? 0,
    reference: doc?.reference ?? "",
    notes: doc?.notes ?? "",
    type: doc?.type ?? "STANDARD",
    kind: doc?.kind ?? "INVOICE",
    salespersonId: doc?.salespersonId ?? "",
    vendorInvoiceNumber: doc?.vendorInvoiceNumber ?? "",
  });
  const [lines, setLines] = React.useState<DocLine[]>(doc?.lines.map((l) => ({ ...l, taxCodeId: l.taxCodeId ?? null })) ?? (initialLines && initialLines.length > 0 ? initialLines.map((l) => ({ ...l, taxCodeId: l.taxCodeId ?? defaultTax })) : [{ ...emptyLine(), taxCodeId: defaultTax }]));
  const [busy, setBusy] = React.useState<string | null>(null);
  const [creditWarning, setCreditWarning] = React.useState<string | null>(null);

  // party change → default terms/currency
  const onParty = (id: string | null) => {
    const p = parties.find((x) => x.value === id);
    const terms = Number(p?.meta?.terms ?? 30);
    const d = new Date(head.docDate);
    d.setUTCDate(d.getUTCDate() + (mode === "QUOTE" ? 30 : terms));
    setHead((h) => ({ ...h, partyId: id ?? "", dueDate: d.toISOString().slice(0, 10), currencyCode: String(p?.meta?.currency ?? "SAR"), exchangeRate: (p?.meta?.currency ?? "SAR") === "SAR" ? 1 : h.exchangeRate }));
    // re-price item lines for the new customer
    if (sales && pricing && id) setLines((ls) => ls.map((l) => (l.itemId ? { ...l, ...priced(id, l.itemId, Number(l.quantity || 1), Number(l.unitPrice || 0)) } : l)));
  };
  const priced = (customerId: string | null, itemId: string, qty: number, fallback: number) => {
    if (!sales || !pricing) return {};
    const r = pickPrice(pricing, customerId, itemId, qty, fallback);
    return { unitPrice: r.price, ...(r.discountPct ? { discountPct: r.discountPct } : {}) };
  };
  const onItem = (i: number, id: string | null) => {
    const it = items.find((x) => x.value === id);
    const m = it?.meta ?? {};
    const basePrice = Number(sales ? m.salePrice ?? 0 : m.costPrice ?? 0);
    setLines((p) => p.map((l, j) => (j === i ? { ...l, itemId: id, descriptionAr: String(m.nameAr ?? l.descriptionAr), descriptionEn: String(m.nameEn ?? l.descriptionEn), unitPrice: basePrice, taxCodeId: (m.taxCodeId as string | null) ?? l.taxCodeId ?? defaultTax, accountId: (sales ? (m.revenueAccountId as string | null) : (m.expenseAccountId as string | null)) ?? l.accountId, ...(id ? priced(head.partyId || null, id, Number(l.quantity || 1), basePrice) : {}) } : l)));
  };
  const upd = (i: number, patch: Partial<DocLine>) => setLines((p) => p.map((l, j) => (j === i ? { ...l, ...patch } : l)));

  // client-side totals (mirrors server computeDocument)
  const factor = 1 - Number(head.discountPct || 0) / 100;
  const calc = lines.map((l) => {
    const gross = Number(l.quantity || 0) * Number(l.unitPrice || 0);
    const net = Math.round(gross * (1 - Number(l.discountPct || 0) / 100) * factor * 100) / 100;
    const rate = Number(lookups.taxCodes.find((x) => x.value === l.taxCodeId)?.meta?.rate ?? 0);
    const tax = Math.round(net * rate) / 100;
    return { gross, net, tax, total: net + tax };
  });
  const subtotal = calc.reduce((a, c) => a + c.gross, 0);
  const netTotal = calc.reduce((a, c) => a + c.net, 0);
  const taxTotal = calc.reduce((a, c) => a + c.tax, 0);
  const total = calc.reduce((a, c) => a + c.total, 0);
  const fail = (err: string) => toast.error(te.has(err) ? te(err) : err);

  const payload = () => ({
    ...(extraPayload ?? {}),
    id: doc?.id ?? null,
    [sales ? "customerId" : "vendorId"]: head.partyId,
    branchId: head.branchId || null,
    docDate: head.docDate,
    dueDate: head.dueDate,
    supplyDate: head.supplyDate || null,
    currencyCode: head.currencyCode,
    exchangeRate: Number(head.exchangeRate) || 1,
    discountPct: Number(head.discountPct) || 0,
    reference: head.reference || null,
    notes: head.notes || null,
    type: head.type,
    kind: head.kind,
    salespersonId: head.salespersonId || null,
    vendorInvoiceNumber: head.vendorInvoiceNumber || null,
    originalId: doc?.originalId ?? null,
    lines: lines.filter((l) => l.descriptionEn || l.descriptionAr).map((l) => ({ ...l, descriptionAr: l.descriptionAr || l.descriptionEn, descriptionEn: l.descriptionEn || l.descriptionAr, quantity: Number(l.quantity || 0), unitPrice: Number(l.unitPrice || 0), discountPct: Number(l.discountPct || 0) })),
  });

  const save = async () => {
    setBusy("save");
    const res = await actions.save(payload());
    setBusy(null);
    if (res.ok) {
      toast.success(tc("saved"));
      const d = res.data as { id: string };
      if (!doc) router.replace(`/${locale}${listHref}/${d.id}`);
      else router.refresh();
    } else fail(res.fieldErrors ? Object.entries(res.fieldErrors).map(([k, v]) => `${k}: ${v[0]}`).join("; ") : res.error);
  };
  const post = async (overrideCredit = false) => {
    if (!doc || !actions.post) return;
    setBusy("post");
    const res = await actions.post({ id: doc.id, overrideCredit });
    setBusy(null);
    if (res.ok) {
      { const st = (res.data as { status: string }).status; toast.success(st === "PENDING_APPROVAL" ? t("sentForApproval") : st === "POSTED" ? t("posted") : (postLabel ?? t("posted"))); }
      setCreditWarning(null);
      router.refresh();
    } else if (res.error.startsWith("CREDIT_LIMIT_EXCEEDED")) {
      setCreditWarning(res.error.split(":")[1] ?? "");
    } else fail(res.error);
  };

  const kindLabel = mode === "QUOTE" ? t("quotation") : mode === "ORDER" ? t("salesOrder") : mode === "PO" ? t("purchaseOrder") : mode === "AR" ? (doc?.kind === "CREDIT_NOTE" ? t("creditNote") : t("invoice")) : t("bill");
  const newLabel = mode === "QUOTE" ? t("quotations.new") : mode === "ORDER" ? t("orders.new") : mode === "PO" ? t("purchaseOrders.new") : mode === "AR" ? t("invoices.new") : t("bills.new");
  const title = doc ? `${kindLabel} ${doc.number}` : newLabel;
  const dueLabel = mode === "QUOTE" ? t("validUntil") : mode === "ORDER" ? t("deliveryDate") : mode === "PO" ? t("expectedDate") : t("dueDate");

  return (
    <>
      <PageHeader
        title={title}
        actions={
          <>
            <Button variant="ghost" size="sm" asChild><Link href={listHref}><ArrowLeft className="rtl:rotate-180" /> {tc("back")}</Link></Button>
            {doc && <DocStatus status={doc.status} />}
            {doc && doc.status !== "DRAFT" && <PdfButtons doc={pdfDoc} id={doc.id} />}
          </>
        }
      />
      <div className="space-y-4">
        <Card>
          <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1 lg:col-span-2">
              <Label>{sales ? t("customer") : t("vendor")} *</Label>
              <Combobox options={parties} value={head.partyId} disabled={!editable} onChange={onParty} allowClear={false} />
            </div>
            {mode === "AR" && (
              <>
                <div className="space-y-1">
                  <Label>{t("invoiceType")}</Label>
                  <Select value={head.type} disabled={!editable} onValueChange={(v) => setHead({ ...head, type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="STANDARD">{tk("InvoiceType.STANDARD")}</SelectItem><SelectItem value="SIMPLIFIED">{tk("InvoiceType.SIMPLIFIED")}</SelectItem></SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>{tf("type")}</Label>
                  <Select value={head.kind} disabled={!editable || !!doc?.originalId} onValueChange={(v) => setHead({ ...head, kind: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{["INVOICE", "CREDIT_NOTE", "DEBIT_NOTE"].map((k) => <SelectItem key={k} value={k}>{tk(`InvoiceKind.${k}`)}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </>
            )}
            {mode === "AP" && (
              <div className="space-y-1 lg:col-span-2">
                <Label>{t("vendorInvoiceNumber")}</Label>
                <Input dir="ltr" value={head.vendorInvoiceNumber} disabled={!editable} onChange={(e) => setHead({ ...head, vendorInvoiceNumber: e.target.value })} />
              </div>
            )}
            <div className="space-y-1"><Label>{tf("date")} *</Label><Input type="date" dir="ltr" value={head.docDate} disabled={!editable} onChange={(e) => setHead({ ...head, docDate: e.target.value })} /></div>
            <div className="space-y-1"><Label>{dueLabel}{mode === "ORDER" || mode === "PO" ? "" : " *"}</Label><Input type="date" dir="ltr" value={head.dueDate} disabled={!editable} onChange={(e) => setHead({ ...head, dueDate: e.target.value })} /></div>
            {mode === "AR" && <div className="space-y-1"><Label>{t("supplyDate")}</Label><Input type="date" dir="ltr" value={head.supplyDate} disabled={!editable} onChange={(e) => setHead({ ...head, supplyDate: e.target.value })} /></div>}
            <div className="space-y-1"><Label>{tf("branch")}</Label><Combobox options={lookups.branches} value={head.branchId} disabled={!editable} onChange={(v) => setHead({ ...head, branchId: v ?? "" })} /></div>
            <div className="space-y-1">
              <Label>{tf("currency")}</Label>
              <Select value={head.currencyCode} disabled={!editable} onValueChange={(v) => setHead({ ...head, currencyCode: v, exchangeRate: v === "SAR" ? 1 : head.exchangeRate })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{lookups.currencies.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>{t("exchangeRate")}</Label><Input type="number" step="0.000001" dir="ltr" value={head.exchangeRate} disabled={!editable || head.currencyCode === "SAR"} onChange={(e) => setHead({ ...head, exchangeRate: Number(e.target.value) })} /></div>
            {sales && <div className="space-y-1"><Label>{t("salesperson")}</Label><Combobox options={lookups.salespersons} value={head.salespersonId} disabled={!editable} onChange={(v) => setHead({ ...head, salespersonId: v ?? "" })} /></div>}
            <div className="space-y-1"><Label>{mode === "ORDER" ? t("customerPo") : mode === "PO" ? t("vendorQuoteRef") : t("reference")}</Label><Input value={head.reference} disabled={!editable} onChange={(e) => setHead({ ...head, reference: e.target.value })} /></div>
            <div className="space-y-1"><Label>{t("headerDiscountPct")}</Label><Input type="number" step="0.01" min="0" max="100" dir="ltr" value={head.discountPct} disabled={!editable} onChange={(e) => setHead({ ...head, discountPct: Number(e.target.value) })} /></div>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8">#</TableHead>
                  <TableHead className="min-w-[180px]">{t("item")}</TableHead>
                  <TableHead className="min-w-[200px]">{tf("description")}</TableHead>
                  <TableHead className="w-20 text-end">{t("qty")}</TableHead>
                  <TableHead className="w-28 text-end">{t("unitPrice")}</TableHead>
                  <TableHead className="w-20 text-end">{t("discPct")}</TableHead>
                  <TableHead className="min-w-[120px]">{tf("taxCode")}</TableHead>
                  <TableHead className="min-w-[180px]">{t("account")}</TableHead>
                  <TableHead className="min-w-[130px]">{tf("costCenter")}</TableHead>
                  <TableHead className="w-28 text-end">{t("net")}</TableHead>
                  <TableHead className="w-24 text-end">{t("vat")}</TableHead>
                  {editable && <TableHead className="w-10" />}
                </TableRow>
              </TableHeader>
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
                    <TableCell><Input className="h-8 text-end" type="number" step="0.01" min="0" dir="ltr" value={l.unitPrice} disabled={!editable} onChange={(e) => upd(i, { unitPrice: e.target.value })} /></TableCell>
                    <TableCell><Input className="h-8 text-end" type="number" step="0.01" min="0" max="100" dir="ltr" value={l.discountPct} disabled={!editable} onChange={(e) => upd(i, { discountPct: e.target.value })} /></TableCell>
                    <TableCell><Combobox size="sm" options={lookups.taxCodes} value={l.taxCodeId} disabled={!editable} onChange={(v) => upd(i, { taxCodeId: v })} /></TableCell>
                    <TableCell><Combobox size="sm" options={accounts} value={l.accountId} disabled={!editable} onChange={(v) => upd(i, { accountId: v })} placeholder={t("defaultAccount")} /></TableCell>
                    <TableCell><Combobox size="sm" options={lookups.costCenters} value={l.costCenterId} disabled={!editable} onChange={(v) => upd(i, { costCenterId: v })} /></TableCell>
                    <TableCell className="text-end tabular-nums" dir="ltr">{formatMoney(calc[i].net, locale, head.currencyCode)}</TableCell>
                    <TableCell className="text-end tabular-nums" dir="ltr">{formatMoney(calc[i].tax, locale, head.currencyCode)}</TableCell>
                    {editable && <TableCell><Button type="button" variant="ghost" size="icon-sm" onClick={() => setLines((p) => p.filter((_, j) => j !== i))} disabled={lines.length <= 1}><Trash2 className="size-3.5" /></Button></TableCell>}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {editable && <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => setLines((p) => [...p, { ...emptyLine(), taxCodeId: defaultTax }])}><Plus /> {t("addLine")}</Button>}
          </CardContent>
        </Card>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardContent className="space-y-3">
              <div className="space-y-1"><Label>{tc("notes")}</Label><Textarea value={head.notes} disabled={!editable} onChange={(e) => setHead({ ...head, notes: e.target.value })} /></div>
              {linkedDocs.length > 0 && (
                <div>
                  <div className="text-sm font-medium mb-1">{t("linkedDocs")}</div>
                  <ul className="text-sm space-y-0.5">
                    {linkedDocs.map((l) => (
                      <li key={l.href} className="flex items-center gap-2"><Link href={l.href} className="text-primary hover:underline" dir="ltr">{l.label}</Link>{l.status && <DocStatus status={l.status} />}</li>
                    ))}
                  </ul>
                </div>
              )}
              {doc && doc.allocations.length > 0 && (
                <div>
                  <div className="text-sm font-medium mb-1">{mode === "AR" ? t("receipts.title") : t("payments.title")}</div>
                  <ul className="text-sm space-y-0.5">
                    {doc.allocations.map((a) => (
                      <li key={a.id} className="flex justify-between">
                        <Link href={`${mode === "AR" ? "/finance/ar/receipts" : "/finance/ap/payments"}/${a.id}`} className="text-primary hover:underline" dir="ltr">{a.number}</Link>
                        <span dir="ltr">{formatMoney(a.amount, locale, doc.currencyCode)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {doc && <JournalLink id={doc.journalEntryId} number={doc.journalNumber} />}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="space-y-1 text-sm">
              <Row label={t("subtotal")} v={formatMoney(subtotal, locale, head.currencyCode)} />
              <Row label={t("discount")} v={formatMoney(subtotal - netTotal, locale, head.currencyCode)} />
              <Row label={t("net")} v={formatMoney(netTotal, locale, head.currencyCode)} />
              <Row label={t("vat")} v={formatMoney(taxTotal, locale, head.currencyCode)} />
              <Row label={t("total")} v={formatMoney(total, locale, head.currencyCode)} bold />
              {doc && doc.paidAmount > 0 && <Row label={t("paid")} v={formatMoney(doc.paidAmount, locale, doc.currencyCode)} />}
              {doc && doc.paidAmount > 0 && <Row label={t("outstanding")} v={formatMoney(doc.total - doc.paidAmount, locale, doc.currencyCode)} bold />}
            </CardContent>
          </Card>
        </div>

        {creditWarning !== null && (
          <Card className="border-amber-300 bg-amber-50 dark:bg-amber-950/30">
            <CardContent className="flex flex-wrap items-center gap-3 text-sm">
              <span>{t("creditLimitExceeded", { amount: creditWarning })}</span>
              {can.approve && <Button size="sm" variant="outline" onClick={() => post(true)}>{t("overrideCredit")}</Button>}
            </CardContent>
          </Card>
        )}

        <div className="flex flex-wrap items-center gap-2">
          {editable && (can.create || can.edit) && <Button onClick={save} disabled={busy !== null || !head.partyId || total <= 0}>{busy === "save" ? <Loader2 className="animate-spin" /> : <Save />} {tc("save")}</Button>}
          {doc && actions.post && (doc.status === "DRAFT" || doc.status === "APPROVED") && can.edit && <Button variant="secondary" onClick={() => post(false)} disabled={busy !== null}>{busy === "post" ? <Loader2 className="animate-spin" /> : <Send />} {postLabel ?? t("post")}</Button>}
          {doc && transitions.filter((tr) => tr.when.includes(doc.status)).map((tr) => (
            <ConfirmButton key={tr.key} title={tr.confirm ?? tr.label} action={() => tr.action(doc.id)} variant={tr.variant ?? "outline"} onSuccess={(d) => { const x = d as { id?: string } | null; if (tr.navigateTo && x?.id) router.push(`/${locale}${tr.navigateTo}/${x.id}`); }}>{tr.label}</ConfirmButton>
          ))}
          {doc && actions.cancel && (doc.status === "DRAFT" || doc.status === "PENDING_APPROVAL") && can.edit && <ConfirmButton title={t("cancelConfirm")} action={() => actions.cancel!(doc.id)} variant="ghost"><Ban /> {t("cancelDoc")}</ConfirmButton>}
          {doc && actions.reverse && doc.status === "POSTED" && doc.paidAmount === 0 && can.approve && <ConfirmButton title={t("reverseConfirm")} action={() => actions.reverse!(doc.id)} variant="outline"><Undo2 /> {t("reverse")}</ConfirmButton>}
          {doc && mode === "AR" && doc.kind === "INVOICE" && ["POSTED", "PARTIALLY_PAID", "PAID"].includes(doc.status) && can.create && actions.creditNote && (
            <ConfirmButton title={t("creditNoteConfirm")} action={() => actions.creditNote!(doc.id)} variant="outline" onSuccess={(d) => router.push(`/${locale}/finance/ar/invoices/${(d as { id: string }).id}`)}><FileMinus /> {t("createCreditNote")}</ConfirmButton>
          )}
        </div>

        {doc && mode === "AR" && doc.zatca && (
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><ShieldCheck className="size-4" /> ZATCA <Badge variant={doc.zatca.status === "CLEARED" || doc.zatca.status === "REPORTED" ? "success" : doc.zatca.status === "REJECTED" ? "destructive" : "secondary"}>{doc.zatca.status}</Badge></CardTitle></CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-[auto_1fr] text-xs">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img alt="QR" src={`/api/zatca/${doc.id}/qr.png`} className="size-36 rounded border bg-white p-1" />
              <div className="space-y-1 min-w-0" dir="ltr">
                <div><span className="text-muted-foreground">UUID:</span> <span className="font-mono">{doc.zatca.uuid}</span></div>
                <div><span className="text-muted-foreground">ICV:</span> {doc.zatca.icv}</div>
                <div className="truncate"><span className="text-muted-foreground">Hash:</span> <span className="font-mono">{doc.zatca.invoiceHash}</span></div>
                {doc.zatca.submittedAt && <div><span className="text-muted-foreground">Submitted:</span> {formatDateTime(doc.zatca.submittedAt, locale)}</div>}
                {doc.zatca.response ? <div className="text-muted-foreground truncate">{JSON.stringify(doc.zatca.response)}</div> : null}
                <div className="flex flex-wrap gap-2 pt-2">
                  <Button size="sm" variant="outline" asChild><a href={`/api/zatca/${doc.id}/xml`} target="_blank" rel="noreferrer"><Code2 /> UBL XML</a></Button>
                  {actions.submitZatca && can.edit && doc.zatca.status !== "CLEARED" && doc.zatca.status !== "REPORTED" && (
                    <ConfirmButton title={t("submitZatca")} action={() => actions.submitZatca!(doc.id)} variant="secondary" size="sm" onSuccess={(d) => toast.info(String((d as { status: string }).status))}><Send /> {t("submitZatca")}</ConfirmButton>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}
        {doc && <AttachmentsPanel entityType={entityType ?? (mode === "AR" ? "CustomerInvoice" : mode === "AP" ? "VendorBill" : mode === "QUOTE" ? "Quotation" : mode === "PO" ? "PurchaseOrder" : "SalesOrder")} entityId={doc.id} items={attachments} canUpload={canAttach.upload} canDelete={canAttach.delete} />}
      </div>
    </>
  );
  function Row({ label, v, bold }: { label: string; v: string; bold?: boolean }) {
    return (
      <div className={`flex justify-between ${bold ? "font-semibold text-base border-t pt-1" : ""}`}>
        <span>{label}</span>
        <span dir="ltr" className="tabular-nums">{v}</span>
      </div>
    );
  }
  void ar;
}
