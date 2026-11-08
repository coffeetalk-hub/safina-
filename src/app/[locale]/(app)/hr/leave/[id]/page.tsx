import { notFound } from "next/navigation";
import { hrPage } from "@/modules/hr/page-helpers";
import { financeLookups } from "@/modules/finance/_shared/lookups";
import { prisma } from "@/lib/prisma";
import { leaveTypes } from "@/modules/hr/settings";
import { allowedEmployeeIds, myEmployee, withEmployee } from "@/modules/hr/employees";
import { balancesFor } from "@/modules/hr/leave";
import { plain, parseListParams } from "@/components/data-table/types";
import { LeaveEditor } from "./client";

export default async function LeaveRequestPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ employeeId?: string }> }) {
  const { id } = await params; const sp = await searchParams;
  const { session, locale, perms } = await hrPage("leave", undefined, { selfService: true });
  const [lk, types, me] = await Promise.all([financeLookups(session.companyId, locale), leaveTypes.all(session, parseListParams({})), myEmployee(session)]);
  const allowed = await allowedEmployeeIds(session, "leave");
  const typeOpts = (types as { id: string; code: string; nameAr: string; nameEn: string; maxDaysPerRequest: number | null; isPaid: boolean }[]).map((x) => ({ value: x.id, label: locale === "ar" ? x.nameAr : x.nameEn, code: x.code, max: x.maxDaysPerRequest, isPaid: x.isPaid }));
  const employeeOpts = allowed ? lk.employees.filter((e) => allowed.includes(e.value)) : lk.employees;
  const defaultEmp = allowed ? (allowed[0] ?? "") : (sp.employeeId ?? me?.id ?? "");
  if (id === "new") {
    const balances = defaultEmp ? await balancesFor(session.companyId, defaultEmp) : [];
    return <LeaveEditor doc={null} employees={employeeOpts} types={typeOpts} defaultEmployeeId={defaultEmp} balances={plain(balances)} perms={{ ...perms, approve: perms.approve }} />;
  }
  const r = await prisma.leaveRequest.findFirst({ where: { id, companyId: session.companyId }, include: { leaveType: true } });
  if (!r || (allowed && !allowed.includes(r.employeeId))) notFound();
  const [row] = await withEmployee(session.companyId, [r]);
  const balances = await balancesFor(session.companyId, r.employeeId, r.startDate.getUTCFullYear());
  const history = await prisma.approvalRequest.findMany({ where: { docType: "LEAVE", docId: id }, include: { actions: { include: { user: { select: { nameAr: true, nameEn: true } } }, orderBy: { at: "asc" } } }, orderBy: { createdAt: "desc" }, take: 1 });
  return <LeaveEditor doc={plain({ ...row, approvals: history[0]?.actions ?? [] })} employees={employeeOpts} types={typeOpts} defaultEmployeeId={r.employeeId} balances={plain(balances)} perms={{ ...perms, approve: perms.approve }} />;
}
