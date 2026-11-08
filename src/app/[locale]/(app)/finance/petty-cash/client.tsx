"use client";

import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Send, Trash2, Undo2, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Combobox } from "@/components/ui/combobox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DataTable } from "@/components/data-table/data-table";
import type { ColumnDef, FilterDef, PagedResult } from "@/components/data-table/types";
import { EntityDialog } from "@/components/forms/entity-dialog";
import { ConfirmButton } from "@/components/forms/confirm-button";
import { useToast } from "@/components/ui/toast";
import { DocStatus } from "@/components/finance/doc-toolbar";
import { deleteVoucherAction, postVoucherAction, removeFundAction, reverseVoucherAction, saveFundAction, saveVoucherAction } from "@/modules/finance/actions";
import type { FinanceLookups } from "@/modules/finance/_shared/lookups";
import { formatMoney } from "@/lib/money";

type Fund = { id: string; code: string; nameAr: string; nameEn: string; branchId: string | null; custodianEmployeeId: string | null; accountId: string; floatAmount: number; isActive: boolean; balance: number; accountCode: string; custodianAr: string; custodianEn: string };
type Row = Record<string, unknown>;

export function PettyCashClient({ funds, vouchers, columns, lookups, can, filters }: { funds: Fund[]; vouchers: PagedResult<Row>; columns: ColumnDef[]; lookups: FinanceLookups; can: { create: boolean; edit: boolean; delete: boolean; approve: boolean }; filters: FilterDef[] }) {
  const t = useTranslations("finance");
  const tf = useTranslations("fields");
  const tc = useTranslations("common");
  const te = useTranslations("errors");
  const tp = useTranslations("enums.PettyCashType");
  const locale = useLocale();
  const toast = useToast();
  const router = useRouter();
  const [fundOpen, setFundOpen] = React.useState(false);
  const [fundEditing, setFundEditing] = React.useState<Fund | null>(null);
  const [vOpen, setVOpen] = React.useState(false);
  const [v, setV] = React.useState<Row | null>(null);
  const [form, setForm] = React.useState({ fundId: "", voucherDate: new Date().toISOString().slice(0, 10), type: "EXPENSE", description: "", amount: "" as string | number, taxCodeId: lookups.taxCodes.find((x) => x.meta?.isDefault)?.value ?? null, expenseAccountId: null as string | null, costCenterId: null as string | null, bankAccountId: (lookups.bankAccounts[0]?.value ?? null) as string | null, vendorName: "" });
  const [busy, setBusy] = React.useState(false);
  const fail = (e: string) => toast.error(te.has(e) ? te(e) : e);
  const expenseAccounts = lookups.accounts.filter((a) => a.meta?.type === "EXPENSE");

  const openVoucher = (row: Row | null) => {
    setV(row);
    setForm(row ? { fundId: String(row.fundId), voucherDate: String(row.voucherDate).slice(0, 10), type: String(row.type), description: String(row.description), amount: Number(row.amount), taxCodeId: (row.taxCodeId as string | null) ?? null, expenseAccountId: (row.expenseAccountId as string | null) ?? null, costCenterId: (row.costCenterId as string | null) ?? null, bankAccountId: (row.bankAccountId as string | null) ?? null, vendorName: String(row.vendorName ?? "") } : { ...form, fundId: funds[0]?.id ?? "", description: "", amount: "", vendorName: "" });
    setVOpen(true);
  };
  const editable = !v || v.status === "DRAFT";
  const taxRate = Number(lookups.taxCodes.find((x) => x.value === form.taxCodeId)?.meta?.rate ?? 0);
  const vat = form.type === "EXPENSE" ? Math.round(Number(form.amount || 0) * taxRate) / 100 : 0;

  const saveV = async () => {
    setBusy(true);
    const res = await saveVoucherAction({ id: v?.id ?? null, ...form, amount: Number(form.amount || 0), vendorName: form.vendorName || null });
    setBusy(false);
    if (res.ok) {
      toast.success(tc("saved"));
      setVOpen(false);
      router.refresh();
    } else fail(res.fieldErrors ? Object.values(res.fieldErrors).flat()[0] : res.error);
  };
  const act = async (fn: () => Promise<{ ok: boolean; error?: string }>) => {
    setBusy(true);
    const res = await fn();
    setBusy(false);
    if (res.ok) {
      toast.success(tc("done"));
      setVOpen(false);
      router.refresh();
    } else fail(res.error ?? "UNKNOWN");
  };

  return (
    <Tabs defaultValue="vouchers">
      <TabsList>
        <TabsTrigger value="vouchers">{t("pettyCash.vouchers")}</TabsTrigger>
        <TabsTrigger value="funds">{t("pettyCash.funds")}</TabsTrigger>
      </TabsList>
      <TabsContent value="vouchers">
        <DataTable tableKey="petty-cash" columns={columns} data={vouchers} filters={filters} exportResource="petty-cash" onRowClick={openVoucher} toolbar={can.create && funds.length > 0 && <Button size="sm" onClick={() => openVoucher(null)}><Plus /> {t("pettyCash.newVoucher")}</Button>} />
      </TabsContent>
      <TabsContent value="funds">
        {can.create && <div className="mb-3 flex justify-end"><Button size="sm" onClick={() => { setFundEditing(null); setFundOpen(true); }}><Plus /> {t("pettyCash.newFund")}</Button></div>}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {funds.map((f) => (
            <Card key={f.id} className="cursor-pointer hover:border-primary/50" onClick={() => { if (can.edit) { setFundEditing(f); setFundOpen(true); } }}>
              <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Wallet className="size-4 text-primary" /> {f.code} · {locale === "ar" ? f.nameAr : f.nameEn} {!f.isActive && <Badge variant="secondary">{tc("inactive")}</Badge>}</CardTitle></CardHeader>
              <CardContent className="text-sm space-y-1">
                <div className="flex justify-between"><span className="text-muted-foreground">{t("balance")}</span><span className="font-semibold tabular-nums" dir="ltr">{formatMoney(f.balance, locale)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">{t("floatAmount")}</span><span dir="ltr">{formatMoney(f.floatAmount, locale)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">{t("custodian")}</span><span>{locale === "ar" ? f.custodianAr : f.custodianEn}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">{t("glAccount")}</span><span dir="ltr">{f.accountCode}</span></div>
              </CardContent>
            </Card>
          ))}
        </div>
        <EntityDialog
          open={fundOpen}
          onOpenChange={setFundOpen}
          title={fundEditing ? t("pettyCash.editFund") : t("pettyCash.newFund")}
          fields={[
            { name: "code", label: tf("code"), required: true, dir: "ltr" },
            { name: "floatAmount", label: t("floatAmount"), type: "number" },
            { name: "nameAr", label: tf("nameAr"), required: true, dir: "rtl" },
            { name: "nameEn", label: tf("nameEn"), required: true, dir: "ltr" },
            { name: "accountId", label: t("glAccount"), type: "select", options: lookups.accounts.filter((a) => a.meta?.type === "ASSET"), required: true },
            { name: "custodianEmployeeId", label: t("custodian"), type: "select", options: lookups.employees },
            { name: "branchId", label: tf("branch"), type: "select", options: lookups.branches },
            { name: "isActive", label: tf("isActive"), type: "switch" },
          ]}
          defaultValues={fundEditing ? { ...fundEditing } : { floatAmount: 0, isActive: true }}
          action={saveFundAction}
        >
          {fundEditing && can.delete && <ConfirmButton title={tc("deleteConfirmTitle")} action={() => removeFundAction(fundEditing.id)} variant="ghost" size="sm" onSuccess={() => setFundOpen(false)}><Trash2 className="text-destructive" /> <span className="text-destructive">{tc("delete")}</span></ConfirmButton>}
        </EntityDialog>
      </TabsContent>

      <Dialog open={vOpen} onOpenChange={setVOpen}>
        <DialogContent size="lg">
          <DialogHeader><DialogTitle className="flex items-center gap-2">{v ? `${t("pettyCash.voucher")} ${String(v.number)}` : t("pettyCash.newVoucher")} {v && <DocStatus status={String(v.status)} />}</DialogTitle></DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1"><Label>{t("fund")} *</Label><Combobox options={funds.map((f) => ({ value: f.id, label: `${f.code} · ${locale === "ar" ? f.nameAr : f.nameEn}` }))} value={form.fundId} disabled={!editable} onChange={(x) => setForm({ ...form, fundId: x ?? "" })} allowClear={false} /></div>
            <div className="space-y-1"><Label>{tf("type")}</Label>
              <Select value={form.type} disabled={!editable} onValueChange={(x) => setForm({ ...form, type: x })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="EXPENSE">{tp("EXPENSE")}</SelectItem><SelectItem value="REPLENISHMENT">{tp("REPLENISHMENT")}</SelectItem></SelectContent></Select>
            </div>
            <div className="space-y-1"><Label>{tf("date")} *</Label><Input type="date" dir="ltr" value={form.voucherDate} disabled={!editable} onChange={(e) => setForm({ ...form, voucherDate: e.target.value })} /></div>
            <div className="space-y-1"><Label>{tf("amount")} {form.type === "EXPENSE" ? `(${t("net")})` : ""} *</Label><Input type="number" step="0.01" min="0" dir="ltr" value={form.amount} disabled={!editable} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
            <div className="space-y-1 sm:col-span-2"><Label>{tf("description")} *</Label><Input value={form.description} disabled={!editable} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            {form.type === "EXPENSE" ? (
              <>
                <div className="space-y-1"><Label>{t("account")} *</Label><Combobox options={expenseAccounts} value={form.expenseAccountId} disabled={!editable} onChange={(x) => setForm({ ...form, expenseAccountId: x })} /></div>
                <div className="space-y-1"><Label>{tf("costCenter")}</Label><Combobox options={lookups.costCenters} value={form.costCenterId} disabled={!editable} onChange={(x) => setForm({ ...form, costCenterId: x })} /></div>
                <div className="space-y-1"><Label>{tf("taxCode")}</Label><Combobox options={lookups.taxCodes} value={form.taxCodeId} disabled={!editable} onChange={(x) => setForm({ ...form, taxCodeId: x })} /></div>
                <div className="space-y-1"><Label>{t("vendor")}</Label><Input value={form.vendorName} disabled={!editable} onChange={(e) => setForm({ ...form, vendorName: e.target.value })} /></div>
                <div className="sm:col-span-2 text-sm text-muted-foreground">{t("vat")}: <span dir="ltr">{formatMoney(vat, locale)}</span> · {t("total")}: <span dir="ltr" className="font-semibold text-foreground">{formatMoney(Number(form.amount || 0) + vat, locale)}</span></div>
              </>
            ) : (
              <div className="space-y-1 sm:col-span-2"><Label>{t("bankAccount")}</Label><Combobox options={lookups.bankAccounts} value={form.bankAccountId} disabled={!editable} onChange={(x) => setForm({ ...form, bankAccountId: x })} /></div>
            )}
          </div>
          <DialogFooter className="sm:justify-between">
            <div className="flex gap-2">
              {v && v.status === "DRAFT" && can.delete && <ConfirmButton title={tc("deleteConfirmTitle")} action={() => deleteVoucherAction(String(v.id))} variant="ghost" size="sm" onSuccess={() => setVOpen(false)}><Trash2 className="text-destructive" /></ConfirmButton>}
              {v && v.status === "POSTED" && can.approve && <ConfirmButton title={t("reverseConfirm")} action={() => reverseVoucherAction(String(v.id))} variant="outline" size="sm" onSuccess={() => setVOpen(false)}><Undo2 /> {t("reverse")}</ConfirmButton>}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setVOpen(false)}>{tc("cancel")}</Button>
              {editable && <Button onClick={saveV} disabled={busy || !form.fundId || !form.description || Number(form.amount) <= 0}>{busy && <Loader2 className="animate-spin" />} {tc("save")}</Button>}
              {v && v.status === "DRAFT" && can.edit && <Button variant="secondary" disabled={busy} onClick={() => act(() => postVoucherAction(String(v.id)))}><Send /> {t("post")}</Button>}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Tabs>
  );
}
