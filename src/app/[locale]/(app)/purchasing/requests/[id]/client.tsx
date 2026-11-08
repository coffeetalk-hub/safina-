"use client";

import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Plus, Save, Send, Trash2, Scale, PackageCheck, Ban } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Combobox } from "@/components/ui/combobox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { ConfirmButton } from "@/components/forms/confirm-button";
import { AttachmentsPanel, type AttachmentItem } from "@/components/attachments/attachments-panel";
import { DocStatus } from "@/components/finance/doc-toolbar";
import { PageHeader } from "@/components/shell/page-header";
import type { FinanceLookups } from "@/modules/finance/_shared/lookups";
import { cancelRequestAction, deleteRequestAction, rfqFromRequestAction, saveRequestAction, submitRequestAction } from "@/modules/purchasing/actions";
import { formatMoney } from "@/lib/money";

type Line = { itemId: string | null; descriptionAr: string; descriptionEn: string; quantity: number | string; unit: string; estimatedPrice: number | string; expenseAccountId: string | null; costCenterId: string | null };
export type RequestDoc = { id: string; number: string; status: string; requestDate: string; neededBy: string | null; requesterId: string | null; costCenterId: string | null; branchId: string | null; purpose: string | null; priority: string; notes: string | null; estimatedTotal: number; lines: Line[]; rfqs: { id: string; number: string; status: string }[]; purchaseOrders: { id: string; number: string; status: string; total: number }[] };

const emptyLine = (): Line => ({ itemId: null, descriptionAr: "", descriptionEn: "", quantity: 1, unit: "EA", estimatedPrice: "", expenseAccountId: null, costCenterId: null });

export function RequestEditor({ doc, lookups, can, extra, attachments, canAttach }: { doc: RequestDoc | null; lookups: FinanceLookups; can: { create: boolean; edit: boolean; delete: boolean }; extra: { rfq: boolean; order: boolean }; attachments: AttachmentItem[]; canAttach: { upload: boolean; delete: boolean } }) {
  const t = useTranslations("purchasing");
  const tf = useTranslations("fields");
  const tc = useTranslations("common");
  const te = useTranslations("errors");
  const tk = useTranslations("enums");
  const tfin = useTranslations("finance");
  const locale = useLocale();
  const toast = useToast();
  const router = useRouter();
  const editable = !doc || doc.status === "DRAFT" || doc.status === "REJECTED";
  const today = new Date().toISOString().slice(0, 10);
  const items = React.useMemo(() => lookups.items.filter((i) => i.meta?.purchasable), [lookups.items]);
  const accounts = React.useMemo(() => lookups.accounts.filter((a) => a.meta?.type === "EXPENSE" || a.meta?.type === "ASSET"), [lookups.accounts]);

  const [head, setHead] = React.useState({ requestDate: doc?.requestDate.slice(0, 10) ?? today, neededBy: doc?.neededBy?.slice(0, 10) ?? "", requesterId: doc?.requesterId ?? (lookups.employees.length === 1 ? lookups.employees[0].value : ""), costCenterId: doc?.costCenterId ?? "", branchId: doc?.branchId ?? "", purpose: doc?.purpose ?? "", priority: doc?.priority ?? "NORMAL", notes: doc?.notes ?? "" });
  const [lines, setLines] = React.useState<Line[]>(doc?.lines.map((l) => ({ ...l })) ?? [emptyLine()]);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [rfqOpen, setRfqOpen] = React.useState(false);
  const [vendorIds, setVendorIds] = React.useState<string[]>([]);
  const [vendorQ, setVendorQ] = React.useState("");

  const upd = (i: number, patch: Partial<Line>) => setLines((p) => p.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const onItem = (i: number, id: string | null) => {
    const m = items.find((x) => x.value === id)?.meta ?? {};
    upd(i, { itemId: id, descriptionAr: String(m.nameAr ?? lines[i].descriptionAr), descriptionEn: String(m.nameEn ?? lines[i].descriptionEn), unit: String(m.unit ?? lines[i].unit), estimatedPrice: Number(m.costPrice ?? 0) || lines[i].estimatedPrice, expenseAccountId: (m.expenseAccountId as string | null) ?? lines[i].expenseAccountId });
  };
  const total = lines.reduce((a, l) => a + Number(l.quantity || 0) * Number(l.estimatedPrice || 0), 0);
  const fail = (err: string) => toast.error(te.has(err) ? te(err) : err);

  const save = async () => {
    setBusy("save");
    const res = await saveRequestAction({ id: doc?.id ?? null, ...head, neededBy: head.neededBy || null, requesterId: head.requesterId || null, costCenterId: head.costCenterId || null, branchId: head.branchId || null, purpose: head.purpose || null, notes: head.notes || null, lines: lines.filter((l) => l.descriptionAr || l.descriptionEn).map((l) => ({ ...l, descriptionAr: l.descriptionAr || l.descriptionEn, descriptionEn: l.descriptionEn || l.descriptionAr, quantity: Number(l.quantity || 0), estimatedPrice: Number(l.estimatedPrice || 0) })) });
    setBusy(null);
    if (res.ok) { toast.success(tc("saved")); const d = res.data as { id: string }; if (!doc) router.replace(`/${locale}/purchasing/requests/${d.id}`); else router.refresh(); }
    else fail(res.fieldErrors ? Object.entries(res.fieldErrors).map(([k, v]) => `${k}: ${v[0]}`).join("; ") : res.error);
  };
  const submit = async () => {
    if (!doc) return;
    setBusy("submit");
    const res = await submitRequestAction(doc.id);
    setBusy(null);
    if (res.ok) { toast.success((res.data as { status: string }).status === "APPROVED" ? t("requests.approved") : tfin("sentForApproval")); router.refresh(); } else fail(res.error);
  };
  const vendors = lookups.vendors.filter((v) => !vendorQ || v.label.toLowerCase().includes(vendorQ.toLowerCase()));
  const title = doc ? `${t("request")} ${doc.number}` : t("requests.new");
  return (
    <>
      <PageHeader title={title} actions={<><Button variant="ghost" size="sm" asChild><Link href="/purchasing/requests"><ArrowLeft className="rtl:rotate-180" /> {tc("back")}</Link></Button>{doc && <DocStatus status={doc.status} />}</>} />
      <div className="space-y-4">
        <Card>
          <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1"><Label>{tf("date")} *</Label><Input type="date" dir="ltr" value={head.requestDate} disabled={!editable} onChange={(e) => setHead({ ...head, requestDate: e.target.value })} /></div>
            <div className="space-y-1"><Label>{t("neededBy")}</Label><Input type="date" dir="ltr" value={head.neededBy} disabled={!editable} onChange={(e) => setHead({ ...head, neededBy: e.target.value })} /></div>
            <div className="space-y-1"><Label>{t("requester")}</Label><Combobox options={lookups.employees} value={head.requesterId} disabled={!editable} onChange={(v) => setHead({ ...head, requesterId: v ?? "" })} /></div>
            <div className="space-y-1">
              <Label>{t("priority")}</Label>
              <Select value={head.priority} disabled={!editable} onValueChange={(v) => setHead({ ...head, priority: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{["LOW", "NORMAL", "HIGH", "URGENT"].map((k) => <SelectItem key={k} value={k}>{tk(`Priority.${k}`)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>{tf("costCenter")}</Label><Combobox options={lookups.costCenters} value={head.costCenterId} disabled={!editable} onChange={(v) => setHead({ ...head, costCenterId: v ?? "" })} /></div>
            <div className="space-y-1"><Label>{tf("branch")}</Label><Combobox options={lookups.branches} value={head.branchId} disabled={!editable} onChange={(v) => setHead({ ...head, branchId: v ?? "" })} /></div>
            <div className="space-y-1 lg:col-span-2"><Label>{t("purpose")}</Label><Input value={head.purpose} disabled={!editable} onChange={(e) => setHead({ ...head, purpose: e.target.value })} /></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <Table>
              <TableHeader><TableRow>
                <TableHead className="w-8">#</TableHead><TableHead className="min-w-[180px]">{tfin("item")}</TableHead><TableHead className="min-w-[200px]">{tf("description")}</TableHead>
                <TableHead className="w-20 text-end">{tfin("qty")}</TableHead><TableHead className="w-20">{tf("unit")}</TableHead><TableHead className="w-28 text-end">{t("estimatedPrice")}</TableHead>
                {accounts.length > 0 && <TableHead className="min-w-[180px]">{tf("expenseAccount")}</TableHead>}<TableHead className="min-w-[130px]">{tf("costCenter")}</TableHead><TableHead className="w-28 text-end">{tfin("total")}</TableHead>{editable && <TableHead className="w-10" />}
              </TableRow></TableHeader>
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
                    <TableCell><Input className="h-8 text-end" type="number" step="0.01" min="0" dir="ltr" value={l.estimatedPrice} disabled={!editable} onChange={(e) => upd(i, { estimatedPrice: e.target.value })} /></TableCell>
                    {accounts.length > 0 && <TableCell><Combobox size="sm" options={accounts} value={l.expenseAccountId} disabled={!editable} onChange={(v) => upd(i, { expenseAccountId: v })} /></TableCell>}
                    <TableCell><Combobox size="sm" options={lookups.costCenters} value={l.costCenterId} disabled={!editable} onChange={(v) => upd(i, { costCenterId: v })} /></TableCell>
                    <TableCell className="text-end tabular-nums" dir="ltr">{formatMoney(Number(l.quantity || 0) * Number(l.estimatedPrice || 0), locale)}</TableCell>
                    {editable && <TableCell><Button type="button" variant="ghost" size="icon-sm" onClick={() => setLines((p) => p.filter((_, j) => j !== i))} disabled={lines.length <= 1}><Trash2 className="size-3.5" /></Button></TableCell>}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {editable && <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => setLines((p) => [...p, emptyLine()])}><Plus /> {tfin("addLine")}</Button>}
          </CardContent>
        </Card>
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2"><CardContent className="space-y-3">
            <div className="space-y-1"><Label>{tc("notes")}</Label><Textarea value={head.notes} disabled={!editable} onChange={(e) => setHead({ ...head, notes: e.target.value })} /></div>
            {doc && (doc.rfqs.length > 0 || doc.purchaseOrders.length > 0) && (
              <div>
                <div className="text-sm font-medium mb-1">{tfin("linkedDocs")}</div>
                <ul className="text-sm space-y-0.5">
                  {doc.rfqs.map((r) => <li key={r.id} className="flex items-center gap-2"><Link href={`/purchasing/rfq/${r.id}`} className="text-primary hover:underline" dir="ltr">{r.number}</Link><DocStatus status={r.status} /></li>)}
                  {doc.purchaseOrders.map((o) => <li key={o.id} className="flex items-center gap-2"><Link href={`/purchasing/orders/${o.id}`} className="text-primary hover:underline" dir="ltr">{o.number}</Link><DocStatus status={o.status} /><span dir="ltr" className="text-muted-foreground">{formatMoney(o.total, locale)}</span></li>)}
                </ul>
              </div>
            )}
          </CardContent></Card>
          <Card><CardContent className="text-sm flex justify-between font-semibold text-base"><span>{t("estimated")}</span><span dir="ltr" className="tabular-nums">{formatMoney(total, locale)}</span></CardContent></Card>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {editable && (can.create || can.edit) && <Button onClick={save} disabled={busy !== null || total < 0}>{busy === "save" ? <Loader2 className="animate-spin" /> : <Save />} {tc("save")}</Button>}
          {doc && editable && can.edit && <Button variant="secondary" onClick={submit} disabled={busy !== null}>{busy === "submit" ? <Loader2 className="animate-spin" /> : <Send />} {tc("submit")}</Button>}
          {doc && doc.status === "APPROVED" && extra.rfq && <Button variant="default" onClick={() => setRfqOpen(true)}><Scale /> {t("requests.toRfq")}</Button>}
          {doc && doc.status === "APPROVED" && extra.order && <Button variant="outline" asChild><Link href={`/purchasing/orders/new?requestId=${doc.id}`}><PackageCheck /> {t("requests.toOrder")}</Link></Button>}
          {doc && ["DRAFT", "PENDING_APPROVAL", "APPROVED", "REJECTED"].includes(doc.status) && can.edit && <ConfirmButton title={tfin("cancelConfirm")} action={() => cancelRequestAction(doc.id)} variant="ghost"><Ban /> {tfin("cancelDoc")}</ConfirmButton>}
          {doc && doc.status === "DRAFT" && can.delete && <ConfirmButton title={tc("deleteConfirmTitle")} action={() => deleteRequestAction(doc.id)} onSuccess={() => router.push(`/${locale}/purchasing/requests`)}><Trash2 /> {tc("delete")}</ConfirmButton>}
        </div>
        {doc && (attachments.length > 0 || canAttach.upload) && <AttachmentsPanel entityType="PurchaseRequest" entityId={doc.id} items={attachments} canUpload={canAttach.upload} canDelete={canAttach.delete} />}
      </div>
      <Dialog open={rfqOpen} onOpenChange={setRfqOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("requests.toRfq")}</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">{t("rfq.selectVendorsHint")}</p>
          <Input placeholder={tc("search")} value={vendorQ} onChange={(e) => setVendorQ(e.target.value)} />
          <div className="max-h-64 overflow-y-auto space-y-1 rounded border p-2">
            {vendors.map((v) => (
              <label key={v.value} className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox checked={vendorIds.includes(v.value)} onCheckedChange={(c) => setVendorIds((p) => (c ? [...p, v.value] : p.filter((x) => x !== v.value)))} /> {v.label}
              </label>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRfqOpen(false)}>{tc("cancel")}</Button>
            <Button disabled={vendorIds.length === 0 || busy !== null} onClick={async () => { if (!doc) return; setBusy("rfq"); const res = await rfqFromRequestAction({ requestId: doc.id, vendorIds }); setBusy(null); if (res.ok) { setRfqOpen(false); router.push(`/${locale}/purchasing/rfq/${(res.data as { id: string }).id}`); } else fail(res.error); }}>{busy === "rfq" ? <Loader2 className="animate-spin" /> : <Scale />} {t("rfq.create")} ({vendorIds.length})</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
