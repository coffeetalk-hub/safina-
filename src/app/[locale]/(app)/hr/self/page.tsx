import { getLocale, getTranslations } from "next-intl/server";
import { forbidden } from "next/navigation";
import { requireSession, can, canAny } from "@/core/auth/session";
import { prisma } from "@/lib/prisma";
import { myEmployee, empName } from "@/modules/hr/employees";
import { balancesFor } from "@/modules/hr/leave";
import { myPayslips } from "@/modules/hr/payroll";
import { PageHeader } from "@/components/shell/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DocStatus } from "@/components/finance/doc-toolbar";
import { Link } from "@/i18n/navigation";
import { ChevronLeft, ChevronRight, Plus, Printer } from "lucide-react";
import { formatMoney, formatNumber } from "@/lib/money";
import { formatDate } from "@/lib/dates";

export default async function SelfServicePage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const session = await requireSession();
  if (!can(session, "hr.self:view")) forbidden();
  const [locale, t, tf, tc, tk] = await Promise.all([getLocale(), getTranslations("hr"), getTranslations("fields"), getTranslations("common"), getTranslations("enums")]);
  const ar = locale === "ar";
  const me = await myEmployee(session);
  if (!me) return (<><PageHeader title={t("self.title")} /><Card><CardContent className="py-10 text-center text-muted-foreground">{t("self.noRecord")}</CardContent></Card></>);
  const { month: monthParam } = await searchParams;
  const now = new Date(); const currentMonth = now.toISOString().slice(0, 7);
  const month = monthParam && /^\d{4}-(0[1-9]|1[0-2])$/.test(monthParam) && monthParam <= currentMonth ? monthParam : currentMonth;
  const [y, m] = month.split("-").map(Number);
  const from = new Date(Date.UTC(y, m - 1, 1)), to = new Date(Date.UTC(y, m, 0));
  const shift = (d: number) => new Date(Date.UTC(y, m - 1 + d, 1)).toISOString().slice(0, 7);
  const [balances, leaves, att, slips, loans, docs] = await Promise.all([
    balancesFor(session.companyId, me.id),
    prisma.leaveRequest.findMany({ where: { employeeId: me.id }, orderBy: { startDate: "desc" }, take: 50, include: { leaveType: { select: { nameAr: true, nameEn: true } } } }),
    prisma.attendanceRecord.findMany({ where: { employeeId: me.id, day: { gte: from, lte: to } }, orderBy: { day: "desc" } }),
    myPayslips(session, me.id),
    prisma.employeeLoan.findMany({ where: { employeeId: me.id, status: { in: ["ACTIVE", "APPROVED", "PENDING_APPROVAL"] } } }),
    prisma.employeeDocument.findMany({ where: { employeeId: me.id }, orderBy: { expiryDate: "asc" } }),
  ]);
  const n = empName(me);
  const present = att.filter((a) => a.status === "PRESENT" || a.status === "REMOTE").length, absent = att.filter((a) => a.status === "ABSENT").length, ot = att.reduce((a, r) => a + Number(r.overtimeHrs), 0);
  return (
    <>
      <PageHeader title={t("self.title")} description={`${me.code} · ${ar ? n.nameAr : n.nameEn} · ${ar ? me.jobTitleAr ?? "" : me.jobTitleEn ?? ""}`} actions={<>{canAny(session, ["hr.self:create", "hr.leave:create"]) && <Button asChild><Link href="/hr/leave/new"><Plus /> {t("leave.new")}</Link></Button>}{can(session, "hr.loan:create") && <Button variant="outline" asChild><Link href="/hr/loans/new"><Plus /> {t("loans.new")}</Link></Button>}</>} />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {balances.map((b) => <Card key={b.id}><CardContent><div className="text-xs text-muted-foreground">{ar ? b.leaveType.nameAr : b.leaveType.nameEn}</div><div className="text-2xl font-semibold tabular-nums" dir="ltr">{formatNumber(b.remaining, locale, 1)}</div><div className="text-xs text-muted-foreground" dir="ltr">{t("balances.taken")} {formatNumber(Number(b.taken), locale, 1)} / {formatNumber(Number(b.entitled) + Number(b.carried) + Number(b.adjusted), locale, 1)}</div></CardContent></Card>)}
        <Card><CardContent><div className="text-xs text-muted-foreground">{month === currentMonth ? t("self.thisMonth") : month}</div><div className="text-2xl font-semibold tabular-nums" dir="ltr">{present}</div><div className="text-xs text-muted-foreground">{t("self.presentDays")} · {t("absentDays")}: {absent} · {t("overtimeHrs")}: {formatNumber(ot, locale, 1)}</div></CardContent></Card>
      </div>
      <div className="grid gap-4 lg:grid-cols-2 mt-4">
        <Card><CardHeader><CardTitle className="text-base">{t("self.myLeave")}</CardTitle></CardHeader><CardContent>
          <Table><TableHeader><TableRow><TableHead>{tf("number")}</TableHead><TableHead>{t("leaveType")}</TableHead><TableHead>{tf("from")}</TableHead><TableHead>{tf("to")}</TableHead><TableHead className="text-end">{t("days")}</TableHead><TableHead>{tf("status")}</TableHead></TableRow></TableHeader>
            <TableBody>{leaves.map((l) => <TableRow key={l.id}><TableCell><Link href={`/hr/leave/${l.id}`} className="text-primary hover:underline" dir="ltr">{l.number}</Link></TableCell><TableCell>{ar ? l.leaveType.nameAr : l.leaveType.nameEn}</TableCell><TableCell dir="ltr">{formatDate(l.startDate, locale)}</TableCell><TableCell dir="ltr">{formatDate(l.endDate, locale)}</TableCell><TableCell className="text-end" dir="ltr">{Number(l.days)}</TableCell><TableCell><DocStatus status={l.status} /></TableCell></TableRow>)}
            {leaves.length === 0 && <TableRow><TableCell colSpan={6} className="h-16 text-center text-muted-foreground">{tc("noData")}</TableCell></TableRow>}</TableBody></Table>
        </CardContent></Card>
        <Card><CardHeader><CardTitle className="text-base">{t("self.myPayslips")}</CardTitle></CardHeader><CardContent>
          <Table><TableHeader><TableRow><TableHead>{tf("period")}</TableHead><TableHead>{t("payDate")}</TableHead><TableHead className="text-end">{t("earnings")}</TableHead><TableHead className="text-end">{t("deductions")}</TableHead><TableHead className="text-end">{t("net")}</TableHead><TableHead /></TableRow></TableHeader>
            <TableBody>{slips.map((p) => <TableRow key={p.id}><TableCell><Link href={`/hr/payroll/payslip/${p.id}`} className="text-primary hover:underline" dir="ltr">{p.run.periodYear}-{String(p.run.periodMonth).padStart(2, "0")}</Link></TableCell><TableCell dir="ltr">{formatDate(p.run.payDate, locale)}</TableCell><TableCell className="text-end" dir="ltr">{formatMoney(Number(p.totalEarnings), locale)}</TableCell><TableCell className="text-end" dir="ltr">{formatMoney(Number(p.totalDeductions), locale)}</TableCell><TableCell className="text-end font-semibold" dir="ltr">{formatMoney(Number(p.net), locale)}</TableCell><TableCell><Button size="icon-sm" variant="ghost" asChild><a href={`/api/pdf/payslip/${p.id}?locale=${locale}`} target="_blank" rel="noreferrer"><Printer className="size-4" /></a></Button></TableCell></TableRow>)}
            {slips.length === 0 && <TableRow><TableCell colSpan={6} className="h-16 text-center text-muted-foreground">{tc("noData")}</TableCell></TableRow>}</TableBody></Table>
        </CardContent></Card>
        <Card><CardHeader><CardTitle className="text-base flex items-center justify-between gap-2"><span>{t("self.myAttendance")}</span><span className="flex items-center gap-1 text-sm font-normal"><Button variant="ghost" size="icon-sm" asChild aria-label="previous month"><Link href={`/hr/self?month=${shift(-1)}`}><ChevronLeft className="rtl:rotate-180" /></Link></Button><span dir="ltr" className="tabular-nums">{month}</span>{month < currentMonth && <Button variant="ghost" size="icon-sm" asChild aria-label="next month"><Link href={`/hr/self?month=${shift(1)}`}><ChevronRight className="rtl:rotate-180" /></Link></Button>}</span></CardTitle></CardHeader><CardContent>
          <Table><TableHeader><TableRow><TableHead>{tf("date")}</TableHead><TableHead>{tf("status")}</TableHead><TableHead>{t("checkIn")}</TableHead><TableHead>{t("checkOut")}</TableHead><TableHead className="text-end">{t("lateMin")}</TableHead><TableHead className="text-end">{t("overtimeHrs")}</TableHead></TableRow></TableHeader>
            <TableBody>{att.map((a) => <TableRow key={a.id}><TableCell dir="ltr">{formatDate(a.day, locale)}</TableCell><TableCell><Badge variant={a.status === "ABSENT" ? "destructive" : a.status === "PRESENT" ? "success" : "secondary"}>{tk(`AttendanceStatus.${a.status}`)}</Badge></TableCell><TableCell dir="ltr">{a.checkIn ?? ""}</TableCell><TableCell dir="ltr">{a.checkOut ?? ""}</TableCell><TableCell className="text-end" dir="ltr">{a.lateMin}</TableCell><TableCell className="text-end" dir="ltr">{Number(a.overtimeHrs)}</TableCell></TableRow>)}
            {att.length === 0 && <TableRow><TableCell colSpan={6} className="h-16 text-center text-muted-foreground">{tc("noData")}</TableCell></TableRow>}</TableBody></Table>
        </CardContent></Card>
        <Card><CardHeader><CardTitle className="text-base">{t("self.myDocs")}</CardTitle></CardHeader><CardContent className="space-y-4">
          <Table><TableHeader><TableRow><TableHead>{tf("type")}</TableHead><TableHead>{tf("number")}</TableHead><TableHead>{t("expiryDate")}</TableHead></TableRow></TableHeader>
            <TableBody>{docs.map((d) => <TableRow key={d.id}><TableCell>{tk(`HrDocumentType.${d.type}`)}</TableCell><TableCell dir="ltr">{d.number ?? ""}</TableCell><TableCell dir="ltr">{formatDate(d.expiryDate, locale)}</TableCell></TableRow>)}
            {docs.length === 0 && <TableRow><TableCell colSpan={3} className="h-12 text-center text-muted-foreground">{tc("noData")}</TableCell></TableRow>}</TableBody></Table>
          {loans.length > 0 && <div className="text-sm"><div className="font-medium mb-1">{t("tabs.loans")}</div>{loans.map((l) => <div key={l.id} className="flex justify-between"><Link href={`/hr/loans/${l.id}`} className="text-primary hover:underline" dir="ltr">{l.number}</Link><span dir="ltr">{formatMoney(Number(l.amount) - Number(l.paidAmount), locale)} · <DocStatus status={l.status} /></span></div>)}</div>}
        </CardContent></Card>
      </div>
    </>
  );
}
