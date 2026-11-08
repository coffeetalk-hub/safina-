import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { requireSession, can } from "@/core/auth/session";
import { forbidden } from "next/navigation";
import { getPayslip } from "@/modules/hr/payroll";
import { empName } from "@/modules/hr/employees";
import { PageHeader } from "@/components/shell/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableFooter, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { DocStatus } from "@/components/finance/doc-toolbar";
import { Link } from "@/i18n/navigation";
import { ArrowLeft, Printer } from "lucide-react";
import { formatMoney, formatNumber } from "@/lib/money";
import { formatDate } from "@/lib/dates";

export default async function PayslipPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireSession();
  if (!can(session, "hr.payroll:view") && !can(session, "hr.self:view")) forbidden();
  const [locale, t, tc] = await Promise.all([getLocale(), getTranslations("hr"), getTranslations("common")]);
  const p = await getPayslip(session, id);
  if (!p) notFound();
  const ar = locale === "ar"; const n = empName(p.employee);
  const period = `${p.run.periodYear}-${String(p.run.periodMonth).padStart(2, "0")}`;
  const earnings = p.lines.filter((l) => l.type === "EARNING"); const deductions = p.lines.filter((l) => l.type === "DEDUCTION");
  const back = can(session, "hr.payroll:view") ? `/hr/payroll/${p.runId}` : "/hr/self";
  return (
    <>
      <PageHeader title={`${t("payslip")} ${p.number}`} description={`${p.employee.code} · ${ar ? n.nameAr : n.nameEn} · ${period}`} actions={<><Button variant="ghost" size="sm" asChild><Link href={back}><ArrowLeft className="rtl:rotate-180" /> {tc("back")}</Link></Button><DocStatus status={p.run.status} /><Button variant="outline" size="sm" asChild><a href={`/api/pdf/payslip/${p.id}?locale=${locale}`} target="_blank" rel="noreferrer"><Printer /> PDF</a></Button></>} />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card><CardContent className="text-sm space-y-1">
          {[[t("payDate"), formatDate(p.run.payDate, locale)], [t("paymentMethod"), p.paymentMethod === "CASH" ? tc("none") : `${p.bankName ?? ""} ${p.iban ?? ""}`], [t("workingDays"), p.workingDays], [t("absentDays"), formatNumber(Number(p.absentDays), locale, 1)], [t("unpaidLeaveDays"), formatNumber(Number(p.unpaidLeaveDays), locale, 1)], [t("overtimeHrs"), formatNumber(Number(p.overtimeHrs), locale, 2)], [t("gosi.wage"), formatMoney(Number(p.gosiWage), locale)], [t("gosiEmployer"), formatMoney(Number(p.gosiEmployer), locale)]].map(([k, v]) => <div key={String(k)} className="flex justify-between gap-3"><span className="text-muted-foreground">{k}</span><span dir="ltr">{String(v)}</span></div>)}
          <div className="flex justify-between gap-3 border-t pt-2 text-base font-semibold"><span>{t("net")}</span><span dir="ltr">{formatMoney(Number(p.net), locale)}</span></div>
        </CardContent></Card>
        <Lines title={t("earnings")} rows={earnings} total={Number(p.totalEarnings)} locale={locale} totalLabel={tc("total")} />
        <Lines title={t("deductions")} rows={deductions} total={Number(p.totalDeductions)} locale={locale} totalLabel={tc("total")} />
      </div>
    </>
  );
}

function Lines({ title, rows, total, locale, totalLabel }: { title: string; rows: { id: string; nameAr: string; nameEn: string; amount: unknown }[]; total: number; locale: string; totalLabel: string }) {
  const ar = locale === "ar";
  return (
    <Card><CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader><CardContent>
      <Table><TableBody>{rows.map((l) => <TableRow key={l.id}><TableCell>{ar ? l.nameAr : l.nameEn}</TableCell><TableCell className="text-end tabular-nums" dir="ltr">{formatMoney(Number(l.amount), locale)}</TableCell></TableRow>)}</TableBody>
        <TableFooter><TableRow><TableCell>{totalLabel}</TableCell><TableCell className="text-end tabular-nums font-semibold" dir="ltr">{formatMoney(total, locale)}</TableCell></TableRow></TableFooter></Table>
    </CardContent></Card>
  );
}
