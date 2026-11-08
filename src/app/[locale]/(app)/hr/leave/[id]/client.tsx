"use client";

import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { ArrowLeft, Ban, Check, Loader2, Save, Send, Trash2, X } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Combobox } from "@/components/ui/combobox";
import { useToast } from "@/components/ui/toast";
import { ConfirmButton } from "@/components/forms/confirm-button";
import { DocStatus } from "@/components/finance/doc-toolbar";
import { PageHeader } from "@/components/shell/page-header";
import { cancelLeaveAction, decideLeaveAction, deleteLeaveAction, saveLeaveAction, submitLeaveAction } from "@/modules/hr/actions";
import { calendarDays } from "@/modules/hr/rules";
import { formatDateTime } from "@/lib/dates";

type Opt = { value: string; label: string };
type TypeOpt = Opt & { code: string; max: number | null; isPaid: boolean };
type Bal = { leaveTypeId: string; remaining: number; entitled: number; taken: number; leaveType: { nameAr: string; nameEn: string } };
export type LeaveDoc = { id: string; number: string; status: string; employeeId: string; employeeAr: string; employeeEn: string; leaveTypeId: string; startDate: string; endDate: string; days: number; reason: string | null; approvals: { step: number; decision: string; comment: string | null; at: string; user: { nameAr: string; nameEn: string } }[] };

export function LeaveEditor({ doc, employees, types, defaultEmployeeId, balances, perms }: { doc: LeaveDoc | null; employees: Opt[]; types: TypeOpt[]; defaultEmployeeId: string; balances: Bal[]; perms: { create: boolean; edit: boolean; delete: boolean; approve: boolean; allEmployees: boolean } }) {
  const t = useTranslations("hr"); const tf = useTranslations("fields"); const tc = useTranslations("common"); const te = useTranslations("errors");
  const locale = useLocale(); const ar = locale === "ar"; const toast = useToast(); const router = useRouter();
  const editable = !doc || doc.status === "DRAFT" || doc.status === "REJECTED";
  const today = new Date().toISOString().slice(0, 10);
  const [f, setF] = React.useState({ employeeId: doc?.employeeId ?? defaultEmployeeId, leaveTypeId: doc?.leaveTypeId ?? (types.find((x) => x.code === "ANNUAL")?.value ?? types[0]?.value ?? ""), startDate: doc?.startDate.slice(0, 10) ?? today, endDate: doc?.endDate.slice(0, 10) ?? today, reason: doc?.reason ?? "" });
  const [busy, setBusy] = React.useState<string | null>(null);
  const days = f.startDate && f.endDate && f.endDate >= f.startDate ? calendarDays(new Date(f.startDate), new Date(f.endDate)) : 0;
  const type = types.find((x) => x.value === f.leaveTypeId);
  const bal = balances.find((b) => b.leaveTypeId === f.leaveTypeId);
  const fail = (err: string) => toast.error(te.has(err) ? te(err) : err);
  const save = async () => {
    setBusy("save");
    const r = await saveLeaveAction({ id: doc?.id ?? null, ...f, reason: f.reason || null });
    setBusy(null);
    if (r.ok) { toast.success(tc("saved")); if (!doc) router.replace(`/${locale}/hr/leave/${(r.data as { id: string }).id}`); else router.refresh(); } else fail(r.fieldErrors ? Object.values(r.fieldErrors).flat().join("; ") : r.error);
  };
  const onEmployee = (v: string | null) => { setF({ ...f, employeeId: v ?? "" }); if (!doc && v) router.replace(`/${locale}/hr/leave/new?employeeId=${v}`); };
  return (
    <>
      <PageHeader title={doc ? `${t("leave.one")} ${doc.number}` : t("leave.new")} description={doc ? (ar ? doc.employeeAr : doc.employeeEn) : undefined} actions={<><Button variant="ghost" size="sm" asChild><Link href={perms.allEmployees ? "/hr/leave" : "/hr/self"}><ArrowLeft className="rtl:rotate-180" /> {tc("back")}</Link></Button>{doc && <DocStatus status={doc.status} />}</>} />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2"><CardContent className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1 sm:col-span-2"><Label>{t("employee")} *</Label><Combobox options={employees} value={f.employeeId} disabled={!editable || employees.length <= 1} onChange={onEmployee} allowClear={false} /></div>
          <div className="space-y-1 sm:col-span-2"><Label>{t("leaveType")} *</Label><Combobox options={types} value={f.leaveTypeId} disabled={!editable} onChange={(v) => setF({ ...f, leaveTypeId: v ?? "" })} allowClear={false} /></div>
          <div className="space-y-1"><Label>{tf("startDate")} *</Label><Input type="date" dir="ltr" value={f.startDate} disabled={!editable} onChange={(e) => setF({ ...f, startDate: e.target.value, endDate: f.endDate < e.target.value ? e.target.value : f.endDate })} /></div>
          <div className="space-y-1"><Label>{tf("endDate")} *</Label><Input type="date" dir="ltr" value={f.endDate} disabled={!editable} onChange={(e) => setF({ ...f, endDate: e.target.value })} /></div>
          <div className="space-y-1 sm:col-span-2"><Label>{t("reason")}</Label><Textarea value={f.reason} disabled={!editable} onChange={(e) => setF({ ...f, reason: e.target.value })} /></div>
        </CardContent></Card>
        <Card><CardHeader><CardTitle className="text-base">{t("leave.summary")}</CardTitle></CardHeader><CardContent className="text-sm space-y-2">
          <div className="flex justify-between"><span className="text-muted-foreground">{t("days")}</span><b dir="ltr">{days}</b></div>
          {type && <div className="flex justify-between"><span className="text-muted-foreground">{t("isPaid")}</span><Badge variant={type.isPaid ? "success" : "warning"}>{type.isPaid ? tc("yes") : tc("no")}</Badge></div>}
          {type?.max && <div className="flex justify-between"><span className="text-muted-foreground">{t("leaveTypes.maxDays")}</span><span dir="ltr">{type.max}</span></div>}
          {bal && <><div className="flex justify-between"><span className="text-muted-foreground">{t("balances.remaining")}</span><b dir="ltr" className={bal.remaining - days < 0 ? "text-red-600" : ""}>{bal.remaining}</b></div><div className="flex justify-between"><span className="text-muted-foreground">{t("balances.afterRequest")}</span><span dir="ltr">{Math.round((bal.remaining - days) * 100) / 100}</span></div></>}
          {doc?.approvals?.length ? <div className="pt-2 border-t"><div className="font-medium mb-1">{t("leave.decisions")}</div><ul className="space-y-0.5 text-xs">{doc.approvals.map((a, i) => <li key={i}>#{a.step} {ar ? a.user.nameAr : a.user.nameEn}: <Badge variant={a.decision === "APPROVED" ? "success" : "destructive"}>{a.decision}</Badge> <span className="text-muted-foreground" dir="ltr">{formatDateTime(a.at, locale)}</span>{a.comment ? ` — ${a.comment}` : ""}</li>)}</ul></div> : null}
        </CardContent></Card>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {editable && (perms.create || perms.edit) && <Button onClick={save} disabled={busy !== null || !f.employeeId || !f.leaveTypeId || days <= 0}>{busy === "save" ? <Loader2 className="animate-spin" /> : <Save />} {tc("save")}</Button>}
        {doc && editable && <ConfirmButton title={tc("submit")} description={t("leave.submitHint")} action={() => submitLeaveAction(doc.id)} variant="secondary"><Send /> {tc("submit")}</ConfirmButton>}
        {doc && perms.approve && ["DRAFT", "PENDING_APPROVAL"].includes(doc.status) && <ConfirmButton title={tc("approve")} action={() => decideLeaveAction({ id: doc.id, decision: "APPROVED" })} variant="default"><Check /> {tc("approve")}</ConfirmButton>}
        {doc && perms.approve && ["DRAFT", "PENDING_APPROVAL"].includes(doc.status) && <ConfirmButton title={tc("reject")} action={() => decideLeaveAction({ id: doc.id, decision: "REJECTED" })} variant="outline"><X /> {tc("reject")}</ConfirmButton>}
        {doc && ["DRAFT", "PENDING_APPROVAL", "APPROVED"].includes(doc.status) && <ConfirmButton title={t("leave.cancelConfirm")} action={() => cancelLeaveAction(doc.id)} variant="ghost"><Ban /> {tc("cancel")}</ConfirmButton>}
        {doc && doc.status === "DRAFT" && perms.delete && <ConfirmButton title={tc("deleteConfirmTitle")} action={() => deleteLeaveAction(doc.id)} onSuccess={() => router.push(`/${locale}${perms.allEmployees ? "/hr/leave" : "/hr/self"}`)}><Trash2 /> {tc("delete")}</ConfirmButton>}
      </div>
    </>
  );
}
