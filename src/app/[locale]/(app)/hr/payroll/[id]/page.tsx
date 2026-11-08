import { notFound } from "next/navigation";
import { hrPage } from "@/modules/hr/page-helpers";
import { getRun, payslipColumns } from "@/modules/hr/payroll";
import { can } from "@/core/auth/session";
import { plain } from "@/components/data-table/types";
import { RunView } from "./client";

export default async function PayrollRunPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { session, t, tf, perms } = await hrPage("payroll");
  const run = await getRun(session, id);
  if (!run) notFound();
  return <RunView run={plain(run)} columns={payslipColumns(tf, t)} perms={{ ...perms, wps: can(session, "hr.wps:create"), wpsView: can(session, "hr.wps:view") }} />;
}
