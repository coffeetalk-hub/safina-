import { notFound } from "next/navigation";
import { hrPage } from "@/modules/hr/page-helpers";
import { financeLookups } from "@/modules/finance/_shared/lookups";
import { getLoan } from "@/modules/hr/loans";
import { allowedEmployeeIds, myEmployee } from "@/modules/hr/employees";
import { prisma } from "@/lib/prisma";
import { plain } from "@/components/data-table/types";
import { LoanEditor } from "./client";

export default async function LoanPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ employeeId?: string }> }) {
  const { id } = await params; const sp = await searchParams;
  const { session, locale, perms } = await hrPage("loan", undefined, { selfService: true });
  const [lk, me, allowed] = await Promise.all([financeLookups(session.companyId, locale), myEmployee(session), allowedEmployeeIds(session, "loan")]);
  const employees = allowed ? lk.employees.filter((e) => allowed.includes(e.value)) : lk.employees;
  if (id === "new") return <LoanEditor doc={null} employees={employees} defaultEmployeeId={allowed ? (allowed[0] ?? "") : (sp.employeeId ?? me?.id ?? "")} perms={perms} journal={null} />;
  const l = await getLoan(session, id);
  if (!l) notFound();
  const journal = l.journalEntryId ? await prisma.journalEntry.findUnique({ where: { id: l.journalEntryId }, select: { id: true, number: true } }) : null;
  return <LoanEditor doc={plain(l)} employees={employees} defaultEmployeeId={l.employeeId} perms={perms} journal={journal} />;
}
