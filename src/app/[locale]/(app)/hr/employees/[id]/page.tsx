import { notFound } from "next/navigation";
import { hrPage } from "@/modules/hr/page-helpers";
import { employeeFile } from "@/modules/hr/employees";
import { balancesFor } from "@/modules/hr/leave";
import { financeLookups } from "@/modules/finance/_shared/lookups";
import { can } from "@/core/auth/session";
import { plain } from "@/components/data-table/types";
import { listForEntity } from "@/modules/foundation/attachments/service";
import { EmployeeFile } from "./client";

export default async function EmployeeFilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { session, locale } = await hrPage("employee");
  const [file, lk, attachments] = await Promise.all([employeeFile(session, id), financeLookups(session.companyId, locale), listForEntity(session.companyId, "Employee", id)]);
  if (!file) notFound();
  const balances = await balancesFor(session.companyId, id);
  const perms = { contract: can(session, "hr.contract:edit") || can(session, "hr.contract:create"), document: can(session, "hr.document:edit") || can(session, "hr.document:create"), salary: can(session, "hr.payroll:edit"), leave: can(session, "hr.leave:edit"), loan: can(session, "hr.loan:create"), eosb: can(session, "hr.eosb:create"), deleteDoc: can(session, "hr.document:delete"), deleteContract: can(session, "hr.contract:delete"), attach: can(session, "foundation.attachment:create"), attachDelete: can(session, "foundation.attachment:delete") };
  return <EmployeeFile file={plain({ ...file, balances })} lookups={{ currencies: lk.currencies, employees: lk.employees }} perms={perms} attachments={plain(attachments)} />;
}
