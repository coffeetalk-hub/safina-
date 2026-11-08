"use client";

import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { ArrowDown, Loader2, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { ConfirmButton } from "@/components/forms/confirm-button";
import { removePolicyAction, savePolicyAction } from "@/modules/foundation/approval-policies/actions";
import { formatMoney } from "@/lib/money";

type Opt = { value: string; label: string };
type Step = { roleId: string | null; userId: string | null; nameAr: string; nameEn: string };
type Policy = { id: string; docType: string; nameAr: string; nameEn: string; minAmount: number; maxAmount: number | null; isActive: boolean; steps: (Step & { id: string; order: number; role: { nameAr: string; nameEn: string } | null })[] };

const empty: Step = { roleId: null, userId: null, nameAr: "", nameEn: "" };

export function PoliciesClient({ policies, docTypes, roles, users, can }: { policies: Policy[]; docTypes: string[]; roles: Opt[]; users: Opt[]; can: { create: boolean; edit: boolean; delete: boolean } }) {
  const t = useTranslations("foundation.approvalPolicies");
  const tf = useTranslations("fields");
  const tc = useTranslations("common");
  const te = useTranslations("errors");
  const locale = useLocale();
  const toast = useToast();
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Policy | null>(null);
  const [form, setForm] = React.useState({ docType: docTypes[0], nameAr: "", nameEn: "", minAmount: "0", maxAmount: "", isActive: true });
  const [steps, setSteps] = React.useState<Step[]>([{ ...empty }]);
  const [loading, setLoading] = React.useState(false);

  const openDialog = (p: Policy | null) => {
    setEditing(p);
    setForm({ docType: p?.docType ?? docTypes[0], nameAr: p?.nameAr ?? "", nameEn: p?.nameEn ?? "", minAmount: String(p?.minAmount ?? 0), maxAmount: p?.maxAmount == null ? "" : String(p.maxAmount), isActive: p?.isActive ?? true });
    setSteps(p?.steps.map((s) => ({ roleId: s.roleId, userId: s.userId, nameAr: s.nameAr, nameEn: s.nameEn })) ?? [{ ...empty }]);
    setOpen(true);
  };

  const submit = async () => {
    setLoading(true);
    const res = await savePolicyAction({ id: editing?.id ?? null, ...form, minAmount: Number(form.minAmount || 0), maxAmount: form.maxAmount === "" ? null : Number(form.maxAmount), steps });
    setLoading(false);
    if (res.ok) {
      toast.success(tc("saved"));
      setOpen(false);
      router.refresh();
    } else toast.error(te.has(res.error) ? te(res.error) : res.fieldErrors ? Object.values(res.fieldErrors).flat().join(", ") : res.error);
  };

  return (
    <>
      {can.create && (
        <div className="mb-4 flex justify-end">
          <Button onClick={() => openDialog(null)}>
            <Plus /> {t("new")}
          </Button>
        </div>
      )}
      <div className="grid gap-3 md:grid-cols-2">
        {policies.length === 0 && <p className="text-sm text-muted-foreground">{tc("noData")}</p>}
        {policies.map((p) => (
          <Card key={p.id} className="cursor-pointer hover:border-primary/50" onClick={() => can.edit && openDialog(p)}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Badge variant="outline" className="font-mono" dir="ltr">
                  {p.docType}
                </Badge>
                {locale === "ar" ? p.nameAr : p.nameEn}
                {!p.isActive && <Badge variant="secondary">{tc("inactive")}</Badge>}
              </CardTitle>
              <CardDescription dir="ltr" className="text-start">
                {formatMoney(p.minAmount, locale)} → {p.maxAmount == null ? "∞" : formatMoney(p.maxAmount, locale)}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ol className="space-y-1 text-sm">
                {p.steps.map((s) => (
                  <li key={s.id} className="flex items-center gap-2">
                    <span className="inline-flex size-5 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">{s.order}</span>
                    {locale === "ar" ? s.nameAr : s.nameEn}
                    <span className="text-muted-foreground">— {s.role ? (locale === "ar" ? s.role.nameAr : s.role.nameEn) : users.find((u) => u.value === s.userId)?.label ?? ""}</span>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent size="lg">
          <DialogHeader>
            <DialogTitle>{editing ? t("edit") : t("new")}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>{tf("docType")}</Label>
              <Select value={form.docType} onValueChange={(v) => setForm({ ...form, docType: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{docTypes.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-3 pt-6">
              <Switch checked={form.isActive} onCheckedChange={(v) => setForm({ ...form, isActive: v })} /> <Label>{tf("isActive")}</Label>
            </div>
            <div className="space-y-1"><Label>{tf("nameAr")}</Label><Input dir="rtl" value={form.nameAr} onChange={(e) => setForm({ ...form, nameAr: e.target.value })} /></div>
            <div className="space-y-1"><Label>{tf("nameEn")}</Label><Input dir="ltr" value={form.nameEn} onChange={(e) => setForm({ ...form, nameEn: e.target.value })} /></div>
            <div className="space-y-1"><Label>{tf("minAmount")}</Label><Input type="number" dir="ltr" value={form.minAmount} onChange={(e) => setForm({ ...form, minAmount: e.target.value })} /></div>
            <div className="space-y-1"><Label>{tf("maxAmount")}</Label><Input type="number" dir="ltr" placeholder="∞" value={form.maxAmount} onChange={(e) => setForm({ ...form, maxAmount: e.target.value })} /></div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>{tf("steps")}</Label>
              <Button size="sm" variant="outline" onClick={() => setSteps([...steps, { ...empty }])}><Plus /> {t("addStep")}</Button>
            </div>
            {steps.map((s, i) => (
              <div key={i} className="rounded-md border p-3 space-y-2">
                <div className="flex items-center justify-between text-sm font-medium">
                  <span>{tf("step")} {i + 1}</span>
                  <div className="flex items-center gap-1">
                    {i < steps.length - 1 && (
                      <Button size="icon-sm" variant="ghost" onClick={() => { const n = [...steps]; [n[i], n[i + 1]] = [n[i + 1], n[i]]; setSteps(n); }}><ArrowDown /></Button>
                    )}
                    {steps.length > 1 && <Button size="icon-sm" variant="ghost" onClick={() => setSteps(steps.filter((_, j) => j !== i))}><X /></Button>}
                  </div>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Input dir="rtl" placeholder={tf("nameAr")} value={s.nameAr} onChange={(e) => setSteps(steps.map((x, j) => (j === i ? { ...x, nameAr: e.target.value } : x)))} />
                  <Input dir="ltr" placeholder={tf("nameEn")} value={s.nameEn} onChange={(e) => setSteps(steps.map((x, j) => (j === i ? { ...x, nameEn: e.target.value } : x)))} />
                  <Select value={s.roleId ?? "__none"} onValueChange={(v) => setSteps(steps.map((x, j) => (j === i ? { ...x, roleId: v === "__none" ? null : v, userId: v === "__none" ? x.userId : null } : x)))}>
                    <SelectTrigger><SelectValue placeholder={tf("role")} /></SelectTrigger>
                    <SelectContent><SelectItem value="__none">{tf("role")}: —</SelectItem>{roles.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
                  </Select>
                  <Select value={s.userId ?? "__none"} onValueChange={(v) => setSteps(steps.map((x, j) => (j === i ? { ...x, userId: v === "__none" ? null : v, roleId: v === "__none" ? x.roleId : null } : x)))}>
                    <SelectTrigger><SelectValue placeholder={tf("user")} /></SelectTrigger>
                    <SelectContent><SelectItem value="__none">{tf("user")}: —</SelectItem>{users.map((u) => <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
            ))}
          </div>
          <DialogFooter className="sm:justify-between">
            <div>
              {editing && can.delete && (
                <ConfirmButton title={tc("deleteConfirmTitle")} action={() => removePolicyAction(editing.id)} variant="ghost" size="sm" onSuccess={() => setOpen(false)}>
                  <Trash2 className="text-destructive" /> <span className="text-destructive">{tc("delete")}</span>
                </ConfirmButton>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>{tc("cancel")}</Button>
              <Button onClick={submit} disabled={loading}>{loading && <Loader2 className="animate-spin" />} {tc("save")}</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
