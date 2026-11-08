"use client";

import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Tag, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Combobox } from "@/components/ui/combobox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { ConfirmButton } from "@/components/forms/confirm-button";
import { customerPricingAction, deletePriceListAction, saveCustomerPricingAction, savePriceListAction } from "@/modules/sales/actions";
import type { FinanceLookups } from "@/modules/finance/_shared/lookups";
import { formatMoney } from "@/lib/money";

type PL = { id: string; code: string; nameAr: string; nameEn: string; currencyCode: string; isDefault: boolean; isActive: boolean; validFrom: string | null; validTo: string | null; items: { itemId: string; price: number; minQty: number; item: { code: string; nameAr: string; nameEn: string; salePrice: number } }[] };
type PLItem = { itemId: string; price: number | string; minQty: number | string };

export function PriceListsClient({ lists, lookups, can }: { lists: PL[]; lookups: FinanceLookups; can: { create: boolean; edit: boolean; delete: boolean } }) {
  const t = useTranslations("sales");
  const tf = useTranslations("fields");
  const tc = useTranslations("common");
  const te = useTranslations("errors");
  const locale = useLocale();
  const toast = useToast();
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<PL | null>(null);
  const [form, setForm] = React.useState({ code: "", nameAr: "", nameEn: "", currencyCode: "SAR", isDefault: false, isActive: true, validFrom: "", validTo: "" });
  const [items, setItems] = React.useState<PLItem[]>([]);
  const [busy, setBusy] = React.useState(false);
  // customer pricing tab
  const [customerId, setCustomerId] = React.useState<string>("");
  const [custList, setCustList] = React.useState<string | null>(null);
  const [custPrices, setCustPrices] = React.useState<{ itemId: string; price: number | string; discountPct: number | string }[]>([]);
  const fail = (e: string) => toast.error(te.has(e) ? te(e) : e);
  const items4sale = lookups.items.filter((i) => i.meta?.sellable);

  const openDialog = (pl: PL | null) => {
    setEditing(pl);
    setForm({ code: pl?.code ?? "", nameAr: pl?.nameAr ?? "", nameEn: pl?.nameEn ?? "", currencyCode: pl?.currencyCode ?? "SAR", isDefault: pl?.isDefault ?? false, isActive: pl?.isActive ?? true, validFrom: pl?.validFrom?.slice(0, 10) ?? "", validTo: pl?.validTo?.slice(0, 10) ?? "" });
    setItems(pl?.items.map((i) => ({ itemId: i.itemId, price: i.price, minQty: i.minQty })) ?? []);
    setOpen(true);
  };
  const save = async () => {
    setBusy(true);
    const res = await savePriceListAction({ id: editing?.id ?? null, ...form, validFrom: form.validFrom || null, validTo: form.validTo || null, items: items.filter((i) => i.itemId).map((i) => ({ itemId: i.itemId, price: Number(i.price || 0), minQty: Number(i.minQty || 0) })) });
    setBusy(false);
    if (res.ok) { toast.success(tc("saved")); setOpen(false); router.refresh(); } else fail(res.error);
  };
  const loadCustomer = async (id: string | null) => {
    setCustomerId(id ?? "");
    if (!id) return;
    const res = await customerPricingAction(id);
    if (res.ok) { const d = res.data as { priceListId: string | null; itemPrices: { itemId: string; price: number; discountPct: number }[] }; setCustList(d.priceListId); setCustPrices(d.itemPrices.map((p) => ({ itemId: p.itemId, price: p.price, discountPct: p.discountPct }))); } else fail(res.error);
  };
  const saveCustomer = async () => {
    setBusy(true);
    const res = await saveCustomerPricingAction({ customerId, priceListId: custList, prices: custPrices.filter((p) => p.itemId).map((p) => ({ itemId: p.itemId, price: Number(p.price || 0), discountPct: Number(p.discountPct || 0) })) });
    setBusy(false);
    if (res.ok) { toast.success(tc("saved")); router.refresh(); } else fail(res.error);
  };
  const listOpts = lists.map((l) => ({ value: l.id, label: `${l.code} · ${locale === "ar" ? l.nameAr : l.nameEn}` }));

  return (
    <Tabs defaultValue="lists">
      <TabsList><TabsTrigger value="lists">{t("priceLists.title")}</TabsTrigger><TabsTrigger value="customers">{t("priceLists.customerPricing")}</TabsTrigger></TabsList>
      <TabsContent value="lists">
        {can.create && <div className="mb-3 flex justify-end"><Button size="sm" onClick={() => openDialog(null)}><Plus /> {t("priceLists.new")}</Button></div>}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {lists.length === 0 && <p className="text-sm text-muted-foreground">{tc("noData")}</p>}
          {lists.map((l) => (
            <Card key={l.id} className="cursor-pointer hover:border-primary/50" onClick={() => can.edit && openDialog(l)}>
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><Tag className="size-4 text-primary" /> {l.code} · {locale === "ar" ? l.nameAr : l.nameEn} {l.isDefault && <Badge variant="info">{tf("isDefault")}</Badge>} {!l.isActive && <Badge variant="secondary">{tc("inactive")}</Badge>}</CardTitle></CardHeader>
              <CardContent className="text-sm text-muted-foreground">{l.items.length} {t("priceLists.items")} · {l.currencyCode}{l.validFrom || l.validTo ? ` · ${l.validFrom?.slice(0, 10) ?? ""} → ${l.validTo?.slice(0, 10) ?? ""}` : ""}</CardContent>
            </Card>
          ))}
        </div>
      </TabsContent>
      <TabsContent value="customers" className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1"><Label>{t("customer")}</Label><Combobox options={lookups.customers} value={customerId} onChange={loadCustomer} /></div>
          {customerId && <div className="space-y-1"><Label>{t("priceLists.assignedList")}</Label><Combobox options={listOpts} value={custList} onChange={setCustList} /></div>}
        </div>
        {customerId && (
          <Card>
            <CardHeader><CardTitle className="text-base">{t("priceLists.specialPrices")}</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>{t("item")}</TableHead><TableHead className="text-end w-40">{t("price")}</TableHead><TableHead className="text-end w-32">{t("discPct")}</TableHead><TableHead className="w-10" /></TableRow></TableHeader>
                <TableBody>
                  {custPrices.map((p, i) => (
                    <TableRow key={i}>
                      <TableCell><Combobox size="sm" options={items4sale} value={p.itemId} onChange={(v) => setCustPrices((x) => x.map((r, j) => (j === i ? { ...r, itemId: v ?? "", price: r.price || Number(items4sale.find((it) => it.value === v)?.meta?.salePrice ?? 0) } : r)))} allowClear={false} /></TableCell>
                      <TableCell><Input className="h-8 text-end" type="number" dir="ltr" value={p.price} onChange={(e) => setCustPrices((x) => x.map((r, j) => (j === i ? { ...r, price: e.target.value } : r)))} /></TableCell>
                      <TableCell><Input className="h-8 text-end" type="number" dir="ltr" value={p.discountPct} onChange={(e) => setCustPrices((x) => x.map((r, j) => (j === i ? { ...r, discountPct: e.target.value } : r)))} /></TableCell>
                      <TableCell><Button variant="ghost" size="icon-sm" onClick={() => setCustPrices((x) => x.filter((_, j) => j !== i))}><Trash2 className="size-3.5" /></Button></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="mt-3 flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setCustPrices((x) => [...x, { itemId: "", price: "", discountPct: 0 }])}><Plus /> {t("addLine")}</Button>
                {can.edit && <Button size="sm" onClick={saveCustomer} disabled={busy}>{busy && <Loader2 className="animate-spin" />} {tc("save")}</Button>}
              </div>
            </CardContent>
          </Card>
        )}
      </TabsContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent size="xl">
          <DialogHeader><DialogTitle>{editing ? t("priceLists.edit") : t("priceLists.new")}</DialogTitle></DialogHeader>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1"><Label>{tf("code")}</Label><Input dir="ltr" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} /></div>
            <div className="space-y-1"><Label>{tf("nameAr")}</Label><Input dir="rtl" value={form.nameAr} onChange={(e) => setForm({ ...form, nameAr: e.target.value })} /></div>
            <div className="space-y-1"><Label>{tf("nameEn")}</Label><Input dir="ltr" value={form.nameEn} onChange={(e) => setForm({ ...form, nameEn: e.target.value })} /></div>
            <div className="space-y-1"><Label>{tf("currency")}</Label><Select value={form.currencyCode} onValueChange={(v) => setForm({ ...form, currencyCode: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{lookups.currencies.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-1"><Label>{tf("startDate")}</Label><Input type="date" dir="ltr" value={form.validFrom} onChange={(e) => setForm({ ...form, validFrom: e.target.value })} /></div>
            <div className="space-y-1"><Label>{tf("endDate")}</Label><Input type="date" dir="ltr" value={form.validTo} onChange={(e) => setForm({ ...form, validTo: e.target.value })} /></div>
            <div className="flex items-center gap-4 sm:col-span-3">
              <label className="flex items-center gap-2 text-sm"><Switch checked={form.isDefault} onCheckedChange={(v) => setForm({ ...form, isDefault: v })} /> {tf("isDefault")}</label>
              <label className="flex items-center gap-2 text-sm"><Switch checked={form.isActive} onCheckedChange={(v) => setForm({ ...form, isActive: v })} /> {tf("isActive")}</label>
            </div>
          </div>
          <div className="max-h-[45vh] overflow-auto rounded-md border">
            <Table>
              <TableHeader className="sticky top-0 bg-background"><TableRow><TableHead>{t("item")}</TableHead><TableHead className="text-end w-32">{t("listPrice")}</TableHead><TableHead className="text-end w-36">{t("price")}</TableHead><TableHead className="text-end w-28">{t("minQty")}</TableHead><TableHead className="w-10" /></TableRow></TableHeader>
              <TableBody>
                {items.map((it, i) => (
                  <TableRow key={i}>
                    <TableCell><Combobox size="sm" options={items4sale} value={it.itemId} onChange={(v) => setItems((x) => x.map((r, j) => (j === i ? { ...r, itemId: v ?? "" } : r)))} allowClear={false} /></TableCell>
                    <TableCell className="text-end text-muted-foreground tabular-nums" dir="ltr">{formatMoney(Number(items4sale.find((x) => x.value === it.itemId)?.meta?.salePrice ?? 0), locale)}</TableCell>
                    <TableCell><Input className="h-8 text-end" type="number" dir="ltr" value={it.price} onChange={(e) => setItems((x) => x.map((r, j) => (j === i ? { ...r, price: e.target.value } : r)))} /></TableCell>
                    <TableCell><Input className="h-8 text-end" type="number" dir="ltr" value={it.minQty} onChange={(e) => setItems((x) => x.map((r, j) => (j === i ? { ...r, minQty: e.target.value } : r)))} /></TableCell>
                    <TableCell><Button variant="ghost" size="icon-sm" onClick={() => setItems((x) => x.filter((_, j) => j !== i))}><Trash2 className="size-3.5" /></Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setItems((x) => [...x, { itemId: "", price: "", minQty: 0 }])}><Plus /> {t("addLine")}</Button>
            <Button variant="outline" size="sm" onClick={() => setItems(items4sale.map((i) => ({ itemId: i.value, price: Number(i.meta?.salePrice ?? 0), minQty: 0 })))}>{t("priceLists.addAllItems")}</Button>
          </div>
          <DialogFooter className="sm:justify-between">
            <div>{editing && can.delete && <ConfirmButton title={tc("deleteConfirmTitle")} action={() => deletePriceListAction(editing.id)} variant="ghost" size="sm" onSuccess={() => setOpen(false)}><Trash2 className="text-destructive" /></ConfirmButton>}</div>
            <div className="flex gap-2"><Button variant="outline" onClick={() => setOpen(false)}>{tc("cancel")}</Button><Button onClick={save} disabled={busy || !form.code || !form.nameAr || !form.nameEn}>{busy && <Loader2 className="animate-spin" />} {tc("save")}</Button></div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Tabs>
  );
}
