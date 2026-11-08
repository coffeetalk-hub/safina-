"use client";

import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { ArrowLeft, Ban, BookCheck, Calculator, Check, Landmark, Loader2, Printer, Save } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Combobox } from "@/components/ui/combobox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { ConfirmButton } from "@/components/forms/confirm-button";
import { DocStatus, JournalLink } from "@/components/finance/doc-toolbar";
import { PageHeader } from "@/components/shell/page-header";
import { approveEosbAction, cancelEosbAction, payEosbAction, postEosbAction, previewEosbAction, saveEosbAction } from "@/modules/hr/actions";
import { EOS_REASONS } from "@/modules/hr/constants";
import { formatMoney, formatNumber } from "@/lib/money";
import { formatDate } from "@/lib/dates";

type Opt = { value: string; label: string };
type Preview = { hireDate?: string | null; serviceYears: number; monthlyWage: number; wageBasis?: string; fullEntitlement: number; pct: number; eosbAmount: number; leaveDays: number; leaveEncashment: number; loanBalance: number; otherAdditions: number; otherDeductions: number; netAmount: number };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Doc = any;

export function EosbEditor({ doc, employees, defaultEmployeeId, perms }: { doc: Doc | null; employees: Opt[]; defaultEmployeeId: string; perms: { create: boolean; edit: boolean; approve: boolean } }) {
  const t = useTranslations("hr"); const tf = useTranslations("fields"); const tc = useTranslations("common"); const te = useTranslations("errors"); const tk = useTranslations("enums"); const tfin = useTranslations("finance");
  const locale = useLocale(); const ar = locale === "ar"; const toast = useToast(); const router = useRouter();
  const editable = !doc || doc.status === "DRAFT";
  const [f, setF] = React.useState({ employeeId: doc?.employeeId ?? defaultEmployeeId, terminationDate: doc?.terminationDate?.slice(0, 10) ?? new Date().toISOString().slice(0, 10), reason: doc?.reason ?? "RESIGNATION", leaveDays: doc ? String(Number(doc.leaveDays)) : "", otherAdditions: doc ? String(Number(doc.otherAdditions)) : "0", otherDeductions: doc ? String(Number(doc.otherDeductions)) : "0", notes: doc?.notes ?? "" });
  const [pv, setPv] = React.useState<Preview | null>(doc ? { hireDate: null, serviceYears: Number(doc.serviceYears), monthlyWage: Number(doc.monthlyWage), fullEntitlement: Number(doc.fullEntitlement), pct: doc.eosbPct, eosbAmount: Number(doc.eosbAmount), leaveDays: Number(doc.leaveDays), leaveEncashment: Number(doc.leaveEncashment), loanBalance: Number(doc.loanBalance), otherAdditions: Number(doc.otherAdditions), otherDeductions: Number(doc.otherDeductions), netAmount: Number(doc.netAmount) } : null);
  const [busy, setBusy] = React.useState<string | null>(null);
  const fail = (err: string) => toast.error(te.has(err) ? te(err) : err);
  const payload = () => ({ id: doc?.id ?? null, employeeId: f.employeeId, terminationDate: f.terminationDate, reason: f.reason, leaveDays: f.leaveDays === "" ? null : Number(f.leaveDays), otherAdditions: Number(f.otherAdditions || 0), otherDeductions: Number(f.otherDeductions || 0), notes: f.notes || null });
  const preview = async () => { setBusy("preview"); const r = await previewEosbAction(payload()); setBusy(null); if (r.ok) setPv(r.data as unknown as Preview); else fail(r.error); };
  const save = async () => { setBusy("save"); const r = await saveEosbAction(payload()); setBusy(null); if (r.ok) { toast.success(tc("saved")); if (!doc) router.replace(`/${locale}/hr/eosb/${(r.data as { id: string }).id}`); else router.refresh(); } else fail(r.error); };
  const row = (label: string, v: string, bold?: boolean) => <div className={`flex justify-between gap-3 ${bold ? "border-t pt-2 text-base font-semibold" : ""}`}><span className={bold ? "" : "text-muted-foreground"}>{label}</span><span dir="ltr" className="tabular-nums">{v}</span></div>;
  return (
    <>
      <PageHeader title={doc ? `${t("eos.one")} ${doc.number}` : t("eos.new")} description={doc ? (ar ? doc.employeeAr : doc.employeeEn) : t("eos.hint")} actions={<><Button variant="ghost" size="sm" asChild><Link href="/hr/eosb"><ArrowLeft className="rtl:rotate-180" /> {tc("back")}</Link></Button>{doc && <DocStatus status={doc.status} />}{doc && <Button variant="outline" size="sm" asChild><a href={`/api/pdf/eosb/${doc.id}?locale=${locale}`} target="_blank" rel="noreferrer"><Printer /> PDF</a></Button>}</>} />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card><CardContent className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1 sm:col-span-2"><Label>{t("employee")} *</Label><Combobox options={employees} value={f.employeeId} disabled={!editable} onChange={(v) => setF({ ...f, employeeId: v ?? "" })} allowClear={false} /></div>
          <div className="space-y-1"><Label>{tf("terminationDate")} *</Label><Input type="date" dir="ltr" value={f.terminationDate} disabled={!editable} onChange={(e) => setF({ ...f, terminationDate: e.target.value })} /></div>
          <div className="space-y-1"><Label>{t("eos.reason")} *</Label><Select value={f.reason} disabled={!editable} onValueChange={(v) => setF({ ...f, reason: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{EOS_REASONS.map((r) => <SelectItem key={r} value={r}>{tk(`EosReason.${r}`)}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-1"><Label>{t("eos.leaveDays")}</Label><Input type="number" step="0.5" min="0" dir="ltr" value={f.leaveDays} placeholder={t("eos.leaveAuto")} disabled={!editable} onChange={(e) => setF({ ...f, leaveDays: e.target.value })} /></div>
          <div className="space-y-1"><Label>{t("eos.otherAdditions")}</Label><Input type="number" step="0.01" min="0" dir="ltr" value={f.otherAdditions} disabled={!editable} onChange={(e) => setF({ ...f, otherAdditions: e.target.value })} /></div>
          <div className="space-y-1"><Label>{t("eos.otherDeductions")}</Label><Input type="number" step="0.01" min="0" dir="ltr" value={f.otherDeductions} disabled={!editable} onChange={(e) => setF({ ...f, otherDeductions: e.target.value })} /></div>
          <div className="space-y-1 sm:col-span-2"><Label>{tf("notes")}</Label><Textarea value={f.notes} disabled={!editable} onChange={(e) => setF({ ...f, notes: e.target.value })} /></div>
          {editable && <div className="sm:col-span-2"><Button variant="secondary" onClick={preview} disabled={busy !== null || !f.employeeId}>{busy === "preview" ? <Loader2 className="animate-spin" /> : <Calculator />} {t("eos.preview")}</Button></div>}
        </CardContent></Card>
        <Card><CardHeader><CardTitle className="text-base">{t("eos.statement")}</CardTitle></CardHeader><CardContent className="text-sm space-y-1">
          {pv ? <>
            {pv.hireDate && row(tf("hireDate"), formatDate(pv.hireDate, locale))}
            {row(t("eos.serviceYears"), formatNumber(pv.serviceYears, locale, 2))}
            {row(`${t("eos.monthlyWage")}${pv.wageBasis ? ` (${t(`eos.basis.${pv.wageBasis}`)})` : ""}`, formatMoney(pv.monthlyWage, locale))}
            {row(t("eos.fullEntitlement"), formatMoney(pv.fullEntitlement, locale))}
            {row(`${t("eos.applicablePct")} (${t("eos.art85")})`, `${pv.pct}%`)}
            {row(t("eos.benefit"), formatMoney(pv.eosbAmount, locale))}
            {row(`${t("eos.leaveEncashment")} (${pv.leaveDays} ${t("days")})`, formatMoney(pv.leaveEncashment, locale))}
            {row(t("eos.otherAdditions"), formatMoney(pv.otherAdditions, locale))}
            {row(t("eos.otherDeductions"), `(${formatMoney(pv.otherDeductions, locale)})`)}
            {row(t("eos.loanBalance"), `(${formatMoney(pv.loanBalance, locale)})`)}
            {row(t("eos.netSettlement"), formatMoney(pv.netAmount, locale), true)}
          </> : <p className="text-muted-foreground">{t("eos.previewHint")}</p>}
          <p className="text-xs text-muted-foreground pt-2">{t("eos.lawNote")}</p>
          {doc?.journal && <div className="pt-2"><JournalLink id={doc.journal.id} number={doc.journal.number} /></div>}
          {doc?.payment && <div><JournalLink id={doc.payment.id} number={doc.payment.number} /></div>}
        </CardContent></Card>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {editable && (perms.create || perms.edit) && <Button onClick={save} disabled={busy !== null || !f.employeeId}>{busy === "save" ? <Loader2 className="animate-spin" /> : <Save />} {tc("save")}</Button>}
        {doc && doc.status === "DRAFT" && perms.approve && <ConfirmButton title={tc("approve")} action={() => approveEosbAction(doc.id)} variant="default"><Check /> {tc("approve")}</ConfirmButton>}
        {doc && doc.status === "APPROVED" && perms.approve && <ConfirmButton title={t("eos.post")} description={t("eos.postHint")} action={() => postEosbAction(doc.id)} variant="default"><BookCheck /> {t("eos.post")}</ConfirmButton>}
        {doc && doc.status === "POSTED" && perms.approve && <ConfirmButton title={t("eos.pay")} description={t("eos.payHint")} action={() => payEosbAction(doc.id)} variant="default"><Landmark /> {t("eos.pay")}</ConfirmButton>}
        {doc && ["DRAFT", "APPROVED"].includes(doc.status) && perms.edit && <ConfirmButton title={tfin("cancelConfirm")} action={() => cancelEosbAction(doc.id)} variant="ghost"><Ban /> {tfin("cancelDoc")}</ConfirmButton>}
      </div>
    </>
  );
}
