"use client";

import { useLocale, useTranslations } from "next-intl";
import { signOut } from "next-auth/react";
import { FileDown, LogOut } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/dates";

type Inv = { id: string; number: string; kind: string; invoiceDate: string; dueDate: string; total: number; paidAmount: number; status: string; currencyCode: string };
type Data = { customer: { nameAr: string; nameEn: string; code: string }; invoices: Inv[]; statement: { opening: number; rows: { id: string; date: string; type: string; number: string; debit: number; credit: number; balance: number }[]; closing: number }; company: { nameAr: string; nameEn: string; phone: string | null; email: string | null } };

export function PortalHome({ data, labels }: { data: Data; labels: { title: string } }) {
  const t = useTranslations("portal");
  const te = useTranslations("enums");
  const locale = useLocale();
  const ar = locale === "ar";
  const outstanding = data.invoices.filter((i) => i.kind !== "CREDIT_NOTE").reduce((a, i) => a + (i.total - i.paidAmount), 0);
  const overdue = data.invoices.filter((i) => i.kind !== "CREDIT_NOTE" && i.total - i.paidAmount > 0.005 && new Date(i.dueDate) < new Date()).length;
  return (
    <div className="mx-auto max-w-5xl p-4 space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-background p-4">
        <div><div className="text-sm text-muted-foreground">{ar ? data.company.nameAr : data.company.nameEn} · {labels.title}</div><div className="text-lg font-semibold">{ar ? data.customer.nameAr : data.customer.nameEn} <span className="text-muted-foreground text-sm" dir="ltr">{data.customer.code}</span></div></div>
        <div className="flex gap-2"><Button variant="ghost" size="sm" asChild><Link href="/portal" locale={ar ? "en" : "ar"}>{ar ? "English" : "العربية"}</Link></Button><Button variant="outline" size="sm" onClick={() => signOut({ callbackUrl: `/${locale}/portal/login` })}><LogOut /> {t("signOut")}</Button></div>
      </header>
      <div className="grid gap-3 sm:grid-cols-3">
        <Card><CardHeader><CardTitle className="text-sm text-muted-foreground">{t("outstanding")}</CardTitle></CardHeader><CardContent className="text-2xl font-semibold tabular-nums" dir="ltr">{formatMoney(outstanding, locale)}</CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm text-muted-foreground">{t("overdue")}</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{overdue}</CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm text-muted-foreground">{t("contact")}</CardTitle></CardHeader><CardContent className="text-sm" dir="ltr">{data.company.phone}<br />{data.company.email}</CardContent></Card>
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">{t("invoices")}</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>{t("number")}</TableHead><TableHead>{t("date")}</TableHead><TableHead>{t("dueDate")}</TableHead><TableHead className="text-end">{t("total")}</TableHead><TableHead className="text-end">{t("balance")}</TableHead><TableHead>{t("status")}</TableHead><TableHead /></TableRow></TableHeader>
            <TableBody>
              {data.invoices.length === 0 && <TableRow><TableCell colSpan={7} className="h-16 text-center text-muted-foreground">—</TableCell></TableRow>}
              {data.invoices.map((i) => (
                <TableRow key={i.id}>
                  <TableCell dir="ltr">{i.number} {i.kind === "CREDIT_NOTE" && <Badge variant="outline">{te("InvoiceKind.CREDIT_NOTE")}</Badge>}</TableCell>
                  <TableCell dir="ltr">{formatDate(i.invoiceDate, locale)}</TableCell>
                  <TableCell dir="ltr">{formatDate(i.dueDate, locale)}</TableCell>
                  <TableCell className="text-end tabular-nums" dir="ltr">{formatMoney(i.total, locale, i.currencyCode)}</TableCell>
                  <TableCell className="text-end tabular-nums" dir="ltr">{formatMoney(i.total - i.paidAmount, locale, i.currencyCode)}</TableCell>
                  <TableCell><Badge variant={i.status === "PAID" ? "success" : new Date(i.dueDate) < new Date() ? "destructive" : "info"}>{te(`DocStatus.${i.status}`)}</Badge></TableCell>
                  <TableCell><Button variant="ghost" size="sm" asChild><a href={`/api/portal/invoice/${i.id}?locale=${locale}`} target="_blank" rel="noreferrer"><FileDown /> PDF</a></Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">{t("statement")}</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>{t("date")}</TableHead><TableHead>{t("type")}</TableHead><TableHead>{t("number")}</TableHead><TableHead className="text-end">{t("debit")}</TableHead><TableHead className="text-end">{t("credit")}</TableHead><TableHead className="text-end">{t("balance")}</TableHead></TableRow></TableHeader>
            <TableBody>
              <TableRow className="bg-muted/30 font-medium"><TableCell colSpan={5}>{t("openingBalance")}</TableCell><TableCell className="text-end tabular-nums" dir="ltr">{formatMoney(data.statement.opening, locale)}</TableCell></TableRow>
              {data.statement.rows.map((r) => <TableRow key={r.id}><TableCell dir="ltr">{formatDate(r.date, locale)}</TableCell><TableCell>{r.type === "RECEIPT" ? t("receipt") : te(`InvoiceKind.${r.type}`)}</TableCell><TableCell dir="ltr">{r.number}</TableCell><TableCell className="text-end tabular-nums" dir="ltr">{r.debit ? formatMoney(r.debit, locale) : ""}</TableCell><TableCell className="text-end tabular-nums" dir="ltr">{r.credit ? formatMoney(r.credit, locale) : ""}</TableCell><TableCell className="text-end tabular-nums" dir="ltr">{formatMoney(r.balance, locale)}</TableCell></TableRow>)}
              <TableRow className="bg-muted/40 font-semibold"><TableCell colSpan={5}>{t("closingBalance")}</TableCell><TableCell className="text-end tabular-nums" dir="ltr">{formatMoney(data.statement.closing, locale)}</TableCell></TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
