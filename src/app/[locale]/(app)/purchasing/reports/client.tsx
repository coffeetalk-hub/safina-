"use client";

import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Download, Printer } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Combobox } from "@/components/ui/combobox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatMoney, formatNumber } from "@/lib/money";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

type Opt = { value: string; label: string };
type Row = Record<string, string | number | null>;
type Col = { key: string; label: string; type?: "money" | "number" | "text"; render?: (r: Row) => React.ReactNode; noTotal?: boolean };

function Tbl({ rows, cols, resource, q, totalLabel, locale }: { rows: Row[]; cols: Col[]; resource: string; q: string; totalLabel: string; locale: string }) {
  const num = (c: Col) => c.type && c.type !== "text";
  return (
    <div className="space-y-2">
      <div className="flex justify-end gap-2 no-print"><Button variant="outline" size="sm" asChild><a href={`/api/export/${resource}?${q}`}><Download /> Excel</a></Button><Button variant="outline" size="sm" asChild><a href={`/api/pdf/list/${resource}?${q}`} target="_blank" rel="noreferrer"><Printer /> PDF</a></Button></div>
      <div className="rounded-md border bg-card overflow-x-auto">
        <Table>
          <TableHeader><TableRow>{cols.map((c) => <TableHead key={c.key} className={num(c) ? "text-end" : ""}>{c.label}</TableHead>)}</TableRow></TableHeader>
          <TableBody>
            {rows.length === 0 && <TableRow><TableCell colSpan={cols.length} className="h-16 text-center text-muted-foreground">—</TableCell></TableRow>}
            {rows.map((r, i) => <TableRow key={i}>{cols.map((c) => <TableCell key={c.key} className={num(c) ? "text-end tabular-nums" : ""} dir={num(c) ? "ltr" : undefined}>{c.render ? c.render(r) : c.type === "money" ? formatMoney(Number(r[c.key]), locale) : c.type === "number" ? formatNumber(Number(r[c.key]), locale, 0) : String(r[c.key] ?? "")}</TableCell>)}</TableRow>)}
          </TableBody>
          <TableFooter><TableRow>{cols.map((c, i) => <TableCell key={c.key} className={num(c) ? "text-end tabular-nums" : ""} dir="ltr">{i === 0 ? totalLabel : c.noTotal ? "" : c.type === "money" ? formatMoney(rows.reduce((a, r) => a + Number(r[c.key]), 0), locale) : c.type === "number" ? formatNumber(rows.reduce((a, r) => a + Number(r[c.key]), 0), locale, 0) : ""}</TableCell>)}</TableRow></TableFooter>
        </Table>
      </div>
    </div>
  );
}

export function PurchasingReportsClient({ filters, lookups, data }: { filters: { from: string; to: string; branchId: string; vendorId: string }; lookups: { branches: Opt[]; vendors: Opt[] }; data: { byVendor: Row[]; byItem: Row[]; byPeriod: Row[]; pending: Row[] } }) {
  const t = useTranslations("purchasing");
  const tf = useTranslations("fields");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const set = (k: string, v: string | null) => { const n = new URLSearchParams(sp.toString()); if (v) n.set(k, v); else n.delete(k); router.push(`${pathname}?${n.toString()}`); };
  const qs = new URLSearchParams(sp.toString()); qs.set("locale", locale); const q = qs.toString();
  const name = (r: Row) => (locale === "ar" ? r.nameAr : r.nameEn);
  const docHref = (r: Row) => { const map: Record<string, string> = { PURCHASE_REQUEST: "/purchasing/requests", PURCHASE_ORDER: "/purchasing/orders", BILL: "/finance/ap/bills", PAYMENT: "/finance/ap/payments" }; return `${map[String(r.docType)] ?? "/approvals"}/${r.docId}`; };
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3 no-print">
        <div className="space-y-1"><Label>{tf("from")}</Label><Input type="date" dir="ltr" value={filters.from} onChange={(e) => set("f.from", e.target.value)} className="w-40" /></div>
        <div className="space-y-1"><Label>{tf("to")}</Label><Input type="date" dir="ltr" value={filters.to} onChange={(e) => set("f.to", e.target.value)} className="w-40" /></div>
        <div className="space-y-1 min-w-[180px]"><Label>{tf("branch")}</Label><Combobox options={lookups.branches} value={filters.branchId} onChange={(v) => set("f.branchId", v)} /></div>
        <div className="space-y-1 min-w-[220px]"><Label>{t("vendor")}</Label><Combobox options={lookups.vendors} value={filters.vendorId} onChange={(v) => set("f.vendorId", v)} /></div>
      </div>
      <div className="h-56 rounded-md border bg-card p-3" dir="ltr">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data.byPeriod}><CartesianGrid strokeDasharray="3 3" stroke="var(--border)" /><XAxis dataKey="period" fontSize={11} /><YAxis fontSize={11} /><Tooltip /><Bar dataKey="net" name={t("reports.net")} fill="var(--chart-3)" radius={[4, 4, 0, 0]} /></BarChart>
        </ResponsiveContainer>
      </div>
      <Tabs defaultValue="vendor">
        <TabsList><TabsTrigger value="vendor">{t("reports.byVendor")}</TabsTrigger><TabsTrigger value="item">{t("reports.byItem")}</TabsTrigger><TabsTrigger value="period">{t("reports.byPeriod")}</TabsTrigger><TabsTrigger value="pending">{t("reports.pending")} {data.pending.length > 0 && <Badge variant="warning" className="ms-1">{data.pending.length}</Badge>}</TabsTrigger></TabsList>
        <TabsContent value="vendor"><Tbl q={q} totalLabel={t("reports.total")} locale={locale} rows={data.byVendor} resource="purchases-by-vendor" cols={[{ key: "code", label: tf("code") }, { key: "name", label: t("vendor"), render: name }, { key: "bills", label: t("reports.bills"), type: "number" }, { key: "net", label: t("reports.net"), type: "money" }, { key: "vat", label: t("reports.vat"), type: "money" }, { key: "total", label: t("reports.total"), type: "money" }, { key: "paid", label: t("reports.paid"), type: "money" }]} /></TabsContent>
        <TabsContent value="item"><Tbl q={q} totalLabel={t("reports.total")} locale={locale} rows={data.byItem} resource="purchases-by-item" cols={[{ key: "code", label: tf("code") }, { key: "name", label: t("item"), render: name }, { key: "quantity", label: t("qty"), type: "number" }, { key: "net", label: t("reports.net"), type: "money" }, { key: "total", label: t("reports.total"), type: "money" }]} /></TabsContent>
        <TabsContent value="period"><Tbl q={q} totalLabel={t("reports.total")} locale={locale} rows={data.byPeriod} resource="purchases-by-period" cols={[{ key: "period", label: tf("period") }, { key: "bills", label: t("reports.bills"), type: "number" }, { key: "net", label: t("reports.net"), type: "money" }, { key: "vat", label: t("reports.vat"), type: "money" }, { key: "total", label: t("reports.total"), type: "money" }]} /></TabsContent>
        <TabsContent value="pending"><Tbl q={q} totalLabel={t("reports.total")} locale={locale} rows={data.pending} resource="purchasing-pending-approvals" cols={[{ key: "docType", label: tf("docType"), render: (r) => <Badge variant="outline" className="font-mono" dir="ltr">{String(r.docType)}</Badge> }, { key: "docNumber", label: tf("number"), render: (r) => <Link href={docHref(r)} className="text-primary hover:underline" dir="ltr">{String(r.docNumber)}</Link> }, { key: "requester", label: tf("requestedBy"), render: (r) => (locale === "ar" ? r.requesterAr : r.requesterEn) }, { key: "amount", label: tf("amount"), type: "money" }, { key: "step", label: tf("step"), render: (r) => `${r.step} · ${locale === "ar" ? r.stepAr : r.stepEn}` }, { key: "approver", label: tf("approver"), render: (r) => (locale === "ar" ? r.approverAr : r.approverEn) }, { key: "ageDays", label: t("reports.ageDays"), type: "number", noTotal: true }]} /></TabsContent>
      </Tabs>
    </div>
  );
}
