"use client";

import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Download, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Link } from "@/i18n/navigation";
import { formatMoney, formatNumber } from "@/lib/money";
import { formatDate } from "@/lib/dates";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";

type Row = Record<string, string | number | null>;
type Col = { key: string; label: string; type?: "money" | "number" | "text" | "date"; render?: (r: Row) => React.ReactNode; noTotal?: boolean };
function Tbl({ rows, cols, resource, q, totalLabel, locale }: { rows: Row[]; cols: Col[]; resource: string; q: string; totalLabel?: string; locale: string }) {
  const num = (c: Col) => c.type === "money" || c.type === "number";
  return (
    <div className="space-y-2">
      <div className="flex justify-end gap-2 no-print"><Button variant="outline" size="sm" asChild><a href={`/api/export/${resource}?${q}`}><Download /> Excel</a></Button><Button variant="outline" size="sm" asChild><a href={`/api/pdf/list/${resource}?${q}`} target="_blank" rel="noreferrer"><Printer /> PDF</a></Button></div>
      <div className="rounded-md border bg-card overflow-x-auto">
        <Table>
          <TableHeader><TableRow>{cols.map((c) => <TableHead key={c.key} className={num(c) ? "text-end" : ""}>{c.label}</TableHead>)}</TableRow></TableHeader>
          <TableBody>
            {rows.length === 0 && <TableRow><TableCell colSpan={cols.length} className="h-16 text-center text-muted-foreground">—</TableCell></TableRow>}
            {rows.map((r, i) => <TableRow key={i}>{cols.map((c) => <TableCell key={c.key} className={num(c) ? "text-end tabular-nums" : ""} dir={num(c) || c.type === "date" ? "ltr" : undefined}>{c.render ? c.render(r) : c.type === "money" ? formatMoney(Number(r[c.key]), locale) : c.type === "number" ? formatNumber(Number(r[c.key]), locale, Number.isInteger(Number(r[c.key])) ? 0 : 1) : c.type === "date" ? formatDate(String(r[c.key]), locale) : String(r[c.key] ?? "")}</TableCell>)}</TableRow>)}
          </TableBody>
          {totalLabel && <TableFooter><TableRow>{cols.map((c, i) => <TableCell key={c.key} className={num(c) ? "text-end tabular-nums" : ""} dir="ltr">{i === 0 ? totalLabel : c.noTotal || !num(c) ? "" : c.type === "money" ? formatMoney(rows.reduce((a, r) => a + Number(r[c.key]), 0), locale) : formatNumber(rows.reduce((a, r) => a + Number(r[c.key]), 0), locale, 0)}</TableCell>)}</TableRow></TableFooter>}
        </Table>
      </div>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function HrReportsClient({ year, data }: { year: number; data: any }) {
  const t = useTranslations("hr"); const tf = useTranslations("fields"); const tc = useTranslations("common"); const tk = useTranslations("enums");
  const locale = useLocale(); const ar = locale === "ar";
  const router = useRouter(); const pathname = usePathname(); const sp = useSearchParams();
  const q = `f.year=${year}&locale=${locale}`;
  const name = (r: Row) => (ar ? r.nameAr : r.nameEn);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3 no-print">
        <div className="space-y-1"><Label>{t("year")}</Label><Input type="number" dir="ltr" defaultValue={year} className="w-28" onBlur={(e) => { const n = new URLSearchParams(sp.toString()); n.set("f.year", e.target.value); router.push(`${pathname}?${n}`); }} /></div>
        <div className="flex gap-3 text-sm pb-2"><Badge variant="outline">{t("reports.headcount")}: {data.hc.total}</Badge><Badge variant={data.hc.saudizationPct >= 30 ? "success" : "warning"}>{t("reports.saudization")}: {data.hc.saudizationPct}%</Badge></div>
      </div>
      <div className="h-56 rounded-md border bg-card p-3" dir="ltr">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data.byMonth}><CartesianGrid strokeDasharray="3 3" stroke="var(--border)" /><XAxis dataKey="period" fontSize={11} /><YAxis fontSize={11} /><Tooltip /><Legend /><Bar dataKey="net" name={t("net")} stackId="a" fill="var(--chart-1)" /><Bar dataKey="gosiEmployer" name={t("gosiEmployer")} stackId="a" fill="var(--chart-4)" radius={[4, 4, 0, 0]} /></BarChart>
        </ResponsiveContainer>
      </div>
      <Tabs defaultValue="headcount">
        <TabsList className="flex-wrap h-auto"><TabsTrigger value="headcount">{t("reports.headcount")}</TabsTrigger><TabsTrigger value="month">{t("reports.payrollByMonth")}</TabsTrigger><TabsTrigger value="cc">{t("reports.payrollByCc")}</TabsTrigger><TabsTrigger value="gosi">{t("reports.gosi")}</TabsTrigger><TabsTrigger value="leave">{t("reports.leave")}</TabsTrigger><TabsTrigger value="expiring">{t("reports.expiring")} {data.expiring.length > 0 && <Badge variant="warning" className="ms-1">{data.expiring.length}</Badge>}</TabsTrigger></TabsList>
        <TabsContent value="headcount"><Tbl q={q} locale={locale} totalLabel={tc("total")} rows={data.hc.rows} resource="hr-headcount" cols={[{ key: "department", label: tf("department") }, { key: "total", label: t("reports.headcount"), type: "number" }, { key: "saudi", label: t("reports.saudi"), type: "number" }, { key: "nonSaudi", label: t("reports.nonSaudi"), type: "number" }, { key: "saudizationPct", label: t("reports.saudization"), type: "number", noTotal: true }, { key: "male", label: t("reports.male"), type: "number" }, { key: "female", label: t("reports.female"), type: "number" }]} /></TabsContent>
        <TabsContent value="month"><Tbl q={q} locale={locale} totalLabel={tc("total")} rows={data.byMonth} resource="hr-payroll-by-month" cols={[{ key: "period", label: tf("period") }, { key: "number", label: tf("number") }, { key: "employees", label: t("employeeCount"), type: "number", noTotal: true }, { key: "earnings", label: t("earnings"), type: "money" }, { key: "deductions", label: t("deductions"), type: "money" }, { key: "gosiEmployer", label: t("gosiEmployer"), type: "money" }, { key: "net", label: t("net"), type: "money" }, { key: "cost", label: t("reports.employerCost"), type: "money" }, { key: "status", label: tf("status"), render: (r) => tk(`PayrollStatus.${r.status}`) }]} /></TabsContent>
        <TabsContent value="cc"><Tbl q={q} locale={locale} totalLabel={tc("total")} rows={data.byCc} resource="hr-payroll-by-cost-center" cols={[{ key: "code", label: tf("code") }, { key: "name", label: tf("costCenter"), render: name }, { key: "payslips", label: t("payslips"), type: "number" }, { key: "earnings", label: t("earnings"), type: "money" }, { key: "gosiEmployer", label: t("gosiEmployer"), type: "money" }, { key: "cost", label: t("reports.employerCost"), type: "money" }]} /></TabsContent>
        <TabsContent value="gosi"><Tbl q={q} locale={locale} totalLabel={tc("total")} rows={data.gosi} resource="hr-gosi-summary" cols={[{ key: "period", label: tf("period") }, { key: "saudi", label: t("reports.saudi"), type: "number", noTotal: true }, { key: "nonSaudi", label: t("reports.nonSaudi"), type: "number", noTotal: true }, { key: "wage", label: t("gosi.wage"), type: "money" }, { key: "employee", label: t("gosiEmployee"), type: "money" }, { key: "employer", label: t("gosiEmployer"), type: "money" }, { key: "total", label: t("reports.total"), type: "money" }]} /></TabsContent>
        <TabsContent value="leave"><Tbl q={q} locale={locale} rows={data.leave} resource="hr-leave-summary" cols={[{ key: "code", label: tf("code") }, { key: "name", label: t("employee"), render: name }, { key: "department", label: tf("department") }, { key: "annualEntitled", label: t("reports.annualEntitled"), type: "number" }, { key: "annualTaken", label: t("reports.annualTaken"), type: "number" }, { key: "annualRemaining", label: t("reports.annualRemaining"), type: "number" }, { key: "sickTaken", label: t("reports.sickTaken"), type: "number" }, { key: "unpaidDays", label: t("reports.unpaidDays"), type: "number" }]} /></TabsContent>
        <TabsContent value="expiring"><Tbl q={q} locale={locale} rows={data.expiring} resource="hr-expiring" cols={[{ key: "kind", label: tf("type"), render: (r) => <Badge variant="outline">{r.kind === "CONTRACT" ? t("tabs.contracts") : t("tabs.documents")}</Badge> }, { key: "type", label: tf("category"), render: (r) => (r.kind === "CONTRACT" ? tk(`ContractType.${r.type}`) : tk(`HrDocumentType.${r.type}`)) }, { key: "number", label: tf("number") }, { key: "name", label: t("employee"), render: (r) => <Link href={`/hr/employees/${r.employeeId}`} className="text-primary hover:underline">{name(r)}</Link> }, { key: "date", label: t("expiryDate"), type: "date" }, { key: "daysLeft", label: t("daysLeft"), render: (r) => <Badge variant={Number(r.daysLeft) < 0 ? "destructive" : Number(r.daysLeft) <= 30 ? "warning" : "secondary"}>{String(r.daysLeft)}</Badge> }]} /></TabsContent>
      </Tabs>
    </div>
  );
}
