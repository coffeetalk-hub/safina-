import { hrPage, type SP } from "@/modules/hr/page-helpers";
import { leaveSummary } from "@/modules/hr/reports";
import { prisma } from "@/lib/prisma";
import { ensureBalances } from "@/modules/hr/leave";
import { PageHeader } from "@/components/shell/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { Download, Printer } from "lucide-react";

export default async function BalancesPage({ searchParams }: { searchParams: SP }) {
  const { session, locale, params, t, tf } = await hrPage("leave", searchParams);
  const year = Number(params.filters.year) || new Date().getUTCFullYear();
  const emps = await prisma.employee.findMany({ where: { companyId: session.companyId, status: { in: ["ACTIVE", "ON_LEAVE"] } }, select: { id: true } });
  for (const e of emps) await ensureBalances(session.companyId, e.id, year);
  const rows = await leaveSummary(session, year);
  const q = `f.year=${year}&locale=${locale}`;
  return (
    <>
      <PageHeader title={`${t("balances.title")} ${year}`} description={t("balances.hint")} actions={<>
        <Button variant="outline" size="sm" asChild><a href={`/api/export/hr-leave-summary?${q}`}><Download /> Excel</a></Button><Button variant="outline" size="sm" asChild><a href={`/api/pdf/list/hr-leave-summary?${q}`} target="_blank" rel="noreferrer"><Printer /> PDF</a></Button>
        <Button variant="ghost" size="sm" asChild><Link href="/hr/leave">{t("leave.title")}</Link></Button></>} />
      <Card><CardContent>
        <Table><TableHeader><TableRow><TableHead>{tf("code")}</TableHead><TableHead>{t("employee")}</TableHead><TableHead>{tf("department")}</TableHead><TableHead className="text-end">{t("reports.annualEntitled")}</TableHead><TableHead className="text-end">{t("reports.annualTaken")}</TableHead><TableHead className="text-end">{t("reports.annualRemaining")}</TableHead><TableHead className="text-end">{t("reports.sickTaken")}</TableHead><TableHead className="text-end">{t("reports.unpaidDays")}</TableHead></TableRow></TableHeader>
          <TableBody>{rows.map((r) => <TableRow key={r.code}><TableCell dir="ltr">{r.code}</TableCell><TableCell>{locale === "ar" ? r.nameAr : r.nameEn}</TableCell><TableCell>{r.department}</TableCell><TableCell className="text-end" dir="ltr">{r.annualEntitled}</TableCell><TableCell className="text-end" dir="ltr">{r.annualTaken}</TableCell><TableCell className="text-end font-semibold" dir="ltr">{r.annualRemaining}</TableCell><TableCell className="text-end" dir="ltr">{r.sickTaken}</TableCell><TableCell className="text-end" dir="ltr">{r.unpaidDays}</TableCell></TableRow>)}</TableBody></Table>
      </CardContent></Card>
    </>
  );
}
