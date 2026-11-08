"use client";

import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { ArrowLeft, Ban, Calculator, Download, FileCheck2, Landmark, Loader2, Send, Undo2, BookCheck } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DataTable } from "@/components/data-table/data-table";
import type { ColumnDef } from "@/components/data-table/types";
import { useToast } from "@/components/ui/toast";
import { ConfirmButton } from "@/components/forms/confirm-button";
import { DocStatus, JournalLink } from "@/components/finance/doc-toolbar";
import { PageHeader } from "@/components/shell/page-header";
import { calculateRunAction, cancelRunAction, generateWpsAction, payRunAction, postRunAction, reopenRunAction, submitRunAction } from "@/modules/hr/actions";
import { formatMoney } from "@/lib/money";
import { formatDate, formatDateTime } from "@/lib/dates";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Run = any;

export function RunView({ run, columns, perms }: { run: Run; columns: ColumnDef[]; perms: { edit: boolean; approve: boolean; wps: boolean; wpsView: boolean } }) {
  const t = useTranslations("hr"); const tc = useTranslations("common"); const te = useTranslations("errors"); const tfin = useTranslations("finance");
  const locale = useLocale(); const toast = useToast(); const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const period = `${run.periodYear}-${String(run.periodMonth).padStart(2, "0")}`;
  const calc = async () => { setBusy(true); const r = await calculateRunAction(run.id); setBusy(false); if (r.ok) { toast.success(t("payroll.calculated", { n: (r.data as { employeesCount: number }).employeesCount })); router.refresh(); } else toast.error(te.has(r.error) ? te(r.error) : r.error); };
  const stat = (label: string, v: number, bold?: boolean) => <div className="rounded-md border bg-card p-3"><div className="text-xs text-muted-foreground">{label}</div><div className={`tabular-nums ${bold ? "text-lg font-semibold" : "text-base"}`} dir="ltr">{formatMoney(v, locale)}</div></div>;
  return (
    <>
      <PageHeader title={`${t("payroll.run")} ${run.number}`} description={`${period} · ${t("payDate")}: ${formatDate(run.payDate, locale)}${run.notes ? ` · ${run.notes}` : ""}`} actions={<><Button variant="ghost" size="sm" asChild><Link href="/hr/payroll"><ArrowLeft className="rtl:rotate-180" /> {tc("back")}</Link></Button><DocStatus status={run.status} /></>} />
      <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-6 mb-4">
        <div className="rounded-md border bg-card p-3"><div className="text-xs text-muted-foreground">{t("employeeCount")}</div><div className="text-base" dir="ltr">{run.employeesCount}</div></div>
        {stat(t("earnings"), Number(run.totalEarnings))}{stat(t("deductions"), Number(run.totalDeductions))}{stat(t("gosiEmployee"), Number(run.totalGosiEmployee))}{stat(t("gosiEmployer"), Number(run.totalGosiEmployer))}{stat(t("net"), Number(run.totalNet), true)}
      </div>
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {["DRAFT", "CALCULATED"].includes(run.status) && perms.edit && <Button onClick={calc} disabled={busy}>{busy ? <Loader2 className="animate-spin" /> : <Calculator />} {run.status === "DRAFT" ? t("payroll.calculate") : t("payroll.recalculate")}</Button>}
        {run.status === "CALCULATED" && perms.edit && <ConfirmButton title={tc("submit")} description={t("payroll.submitHint")} action={() => submitRunAction(run.id)} variant="secondary"><Send /> {tc("submit")}</ConfirmButton>}
        {run.status === "APPROVED" && perms.approve && <ConfirmButton title={t("payroll.post")} description={t("payroll.postHint")} action={() => postRunAction(run.id)} variant="default"><BookCheck /> {t("payroll.post")}</ConfirmButton>}
        {run.status === "POSTED" && perms.approve && <ConfirmButton title={t("payroll.pay")} description={t("payroll.payHint")} action={() => payRunAction(run.id)} variant="default"><Landmark /> {t("payroll.pay")}</ConfirmButton>}
        {["APPROVED", "POSTED", "PAID"].includes(run.status) && perms.wps && <ConfirmButton title={t("payroll.wps")} description={t("payroll.wpsHint")} action={() => generateWpsAction(run.id)} variant="outline"><FileCheck2 /> {run.wpsFile ? t("payroll.wpsRegenerate") : t("payroll.wps")}</ConfirmButton>}
        {run.wpsFile && perms.wpsView && <Button variant="outline" asChild><a href={`/api/hr/wps/${run.id}`}><Download /> {run.wpsFile.fileName}</a></Button>}
        {["CALCULATED", "APPROVED"].includes(run.status) && perms.edit && <ConfirmButton title={t("payroll.reopen")} action={() => reopenRunAction(run.id)} variant="ghost"><Undo2 /> {t("payroll.reopen")}</ConfirmButton>}
        {["DRAFT", "CALCULATED", "PENDING_APPROVAL", "APPROVED"].includes(run.status) && perms.edit && <ConfirmButton title={tfin("cancelConfirm")} action={() => cancelRunAction(run.id)} variant="ghost"><Ban /> {tfin("cancelDoc")}</ConfirmButton>}
        <Button variant="outline" size="sm" asChild><a href={`/api/pdf/list/hr-payslips?f.runId=${run.id}&locale=${locale}`} target="_blank" rel="noreferrer">{t("payroll.register")} PDF</a></Button>
      </div>
      {(run.journal || run.payment || run.wpsFile) && (
        <Card className="mb-4"><CardContent className="text-sm flex flex-wrap gap-6">
          {run.journal && <div><span className="text-muted-foreground">{t("payroll.journal")}: </span><JournalLink id={run.journal.id} number={run.journal.number} /></div>}
          {run.payment && <div><span className="text-muted-foreground">{t("payroll.paymentJournal")}: </span><JournalLink id={run.payment.id} number={run.payment.number} /></div>}
          {run.wpsFile && <div><span className="text-muted-foreground">WPS: </span><span dir="ltr">{run.wpsFile.records} · {formatMoney(Number(run.wpsFile.totalAmount), locale)} · {formatDateTime(run.wpsFile.generatedAt, locale)}</span></div>}
        </CardContent></Card>
      )}
      {run.payslips.length > 0 ? (
        <DataTable tableKey="hr-payslips" columns={columns} data={{ rows: run.payslips, total: run.payslips.length, page: 1, pageSize: 500 }} exportResource="hr-payslips" exportParams={{ "f.runId": run.id }} rowHrefTemplate="/hr/payroll/payslip/{id}" />
      ) : <Card><CardContent className="py-10 text-center text-muted-foreground">{t("payroll.empty")}</CardContent></Card>}
    </>
  );
}
