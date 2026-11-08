"use client";

import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { ArrowLeft, Ban, Banknote, Loader2, Save, Send } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Combobox } from "@/components/ui/combobox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { ConfirmButton } from "@/components/forms/confirm-button";
import { DocStatus, JournalLink } from "@/components/finance/doc-toolbar";
import { PageHeader } from "@/components/shell/page-header";
import { cancelLoanAction, disburseLoanAction, saveLoanAction, submitLoanAction } from "@/modules/hr/actions";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/dates";

type Opt = { value: string; label: string };
export type LoanDoc = { id: string; number: string; status: string; employeeId: string; employeeAr: string; employeeEn: string; loanDate: string; amount: number; installments: number; installmentAmount: number; firstMonth: string; reason: string | null; paidAmount: number; schedule: { id: string; dueMonth: string; amount: number; paidAt: string | null }[] };

export function LoanEditor({ doc, employees, defaultEmployeeId, perms, journal }: { doc: LoanDoc | null; employees: Opt[]; defaultEmployeeId: string; perms: { create: boolean; edit: boolean; approve: boolean; allEmployees: boolean }; journal: { id: string; number: string } | null }) {
  const t = useTranslations("hr"); const tf = useTranslations("fields"); const tc = useTranslations("common"); const te = useTranslations("errors"); const tfin = useTranslations("finance");
  const locale = useLocale(); const ar = locale === "ar"; const toast = useToast(); const router = useRouter();
  const editable = !doc || doc.status === "DRAFT";
  const nextMonth = React.useMemo(() => { const d = new Date(); d.setUTCMonth(d.getUTCMonth() + 1); return d.toISOString().slice(0, 7); }, []);
  const [f, setF] = React.useState({ employeeId: doc?.employeeId ?? defaultEmployeeId, loanDate: doc?.loanDate.slice(0, 10) ?? new Date().toISOString().slice(0, 10), amount: doc?.amount?.toString() ?? "", installments: doc?.installments?.toString() ?? "6", firstMonth: doc?.firstMonth.slice(0, 7) ?? nextMonth, reason: doc?.reason ?? "" });
  const [busy, setBusy] = React.useState(false);
  const inst = Number(f.amount || 0) / Math.max(1, Number(f.installments || 1));
  const fail = (err: string) => toast.error(te.has(err) ? te(err) : err);
  const save = async () => {
    setBusy(true);
    const r = await saveLoanAction({ id: doc?.id ?? null, ...f, amount: Number(f.amount), installments: Number(f.installments), reason: f.reason || null });
    setBusy(false);
    if (r.ok) { toast.success(tc("saved")); if (!doc) router.replace(`/${locale}/hr/loans/${(r.data as { id: string }).id}`); else router.refresh(); } else fail(r.fieldErrors ? Object.values(r.fieldErrors).flat().join("; ") : r.error);
  };
  return (
    <>
      <PageHeader title={doc ? `${t("loans.one")} ${doc.number}` : t("loans.new")} description={doc ? (ar ? doc.employeeAr : doc.employeeEn) : undefined} actions={<><Button variant="ghost" size="sm" asChild><Link href={perms.allEmployees ? "/hr/loans" : "/hr/self"}><ArrowLeft className="rtl:rotate-180" /> {tc("back")}</Link></Button>{doc && <DocStatus status={doc.status} />}</>} />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2"><CardContent className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1 sm:col-span-2"><Label>{t("employee")} *</Label><Combobox options={employees} value={f.employeeId} disabled={!editable || employees.length <= 1} onChange={(v) => setF({ ...f, employeeId: v ?? "" })} allowClear={false} /></div>
          <div className="space-y-1"><Label>{tf("date")} *</Label><Input type="date" dir="ltr" value={f.loanDate} disabled={!editable} onChange={(e) => setF({ ...f, loanDate: e.target.value })} /></div>
          <div className="space-y-1"><Label>{tf("amount")} *</Label><Input type="number" step="0.01" min="0" dir="ltr" value={f.amount} disabled={!editable} onChange={(e) => setF({ ...f, amount: e.target.value })} /></div>
          <div className="space-y-1"><Label>{t("installments")} *</Label><Input type="number" min="1" max="60" dir="ltr" value={f.installments} disabled={!editable} onChange={(e) => setF({ ...f, installments: e.target.value })} /></div>
          <div className="space-y-1"><Label>{t("firstMonth")} *</Label><Input type="month" dir="ltr" value={f.firstMonth} disabled={!editable} onChange={(e) => setF({ ...f, firstMonth: e.target.value })} /></div>
          <div className="space-y-1 sm:col-span-2"><Label>{t("reason")}</Label><Textarea value={f.reason} disabled={!editable} onChange={(e) => setF({ ...f, reason: e.target.value })} /></div>
        </CardContent></Card>
        <Card><CardHeader><CardTitle className="text-base">{t("loans.summary")}</CardTitle></CardHeader><CardContent className="text-sm space-y-2">
          <div className="flex justify-between"><span className="text-muted-foreground">{t("installmentAmount")}</span><b dir="ltr">{formatMoney(inst, locale)}</b></div>
          {doc && <><div className="flex justify-between"><span className="text-muted-foreground">{t("repaid")}</span><span dir="ltr">{formatMoney(doc.paidAmount, locale)}</span></div><div className="flex justify-between"><span className="text-muted-foreground">{t("balance")}</span><b dir="ltr">{formatMoney(doc.amount - doc.paidAmount, locale)}</b></div></>}
          {doc && <JournalLink id={journal?.id ?? null} number={journal?.number} />}
          <p className="text-xs text-muted-foreground">{t("loans.deductHint")}</p>
        </CardContent></Card>
      </div>
      {doc && doc.schedule.length > 0 && (
        <Card className="mt-4"><CardHeader><CardTitle className="text-base">{t("loans.schedule")}</CardTitle></CardHeader><CardContent>
          <Table><TableHeader><TableRow><TableHead>#</TableHead><TableHead>{t("dueMonth")}</TableHead><TableHead className="text-end">{tf("amount")}</TableHead><TableHead>{tf("status")}</TableHead></TableRow></TableHeader>
            <TableBody>{doc.schedule.map((s, i) => <TableRow key={s.id}><TableCell>{i + 1}</TableCell><TableCell dir="ltr">{s.dueMonth.slice(0, 7)}</TableCell><TableCell className="text-end" dir="ltr">{formatMoney(s.amount, locale)}</TableCell><TableCell>{s.paidAt ? <Badge variant="success">{tfin("paid")} · {formatDate(s.paidAt, locale)}</Badge> : <Badge variant="secondary">{t("loans.due")}</Badge>}</TableCell></TableRow>)}</TableBody></Table>
        </CardContent></Card>
      )}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {editable && (perms.create || perms.edit) && <Button onClick={save} disabled={busy || !f.employeeId || Number(f.amount) <= 0}>{busy ? <Loader2 className="animate-spin" /> : <Save />} {tc("save")}</Button>}
        {doc && doc.status === "DRAFT" && <ConfirmButton title={tc("submit")} description={t("loans.submitHint")} action={() => submitLoanAction(doc.id)} variant="secondary"><Send /> {tc("submit")}</ConfirmButton>}
        {doc && doc.status === "APPROVED" && perms.approve && <ConfirmButton title={t("loans.disburse")} description={t("loans.disburseHint")} action={() => disburseLoanAction({ id: doc.id, method: "BANK_DEFAULT" })} variant="default"><Banknote /> {t("loans.disburse")}</ConfirmButton>}
        {doc && ["DRAFT", "PENDING_APPROVAL", "APPROVED"].includes(doc.status) && perms.edit && <ConfirmButton title={tfin("cancelConfirm")} action={() => cancelLoanAction(doc.id)} variant="ghost"><Ban /> {tfin("cancelDoc")}</ConfirmButton>}
      </div>
    </>
  );
}
