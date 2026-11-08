import { notFound } from "next/navigation";
import { hrPage } from "@/modules/hr/page-helpers";
import { financeLookups } from "@/modules/finance/_shared/lookups";
import { getEosb } from "@/modules/hr/eosb";
import { plain } from "@/components/data-table/types";
import { EosbEditor } from "./client";

export default async function EosbPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ employeeId?: string }> }) {
  const { id } = await params; const sp = await searchParams;
  const { session, locale, perms } = await hrPage("eosb");
  const lk = await financeLookups(session.companyId, locale);
  if (id === "new") return <EosbEditor doc={null} employees={lk.employees} defaultEmployeeId={sp.employeeId ?? ""} perms={perms} />;
  const r = await getEosb(session, id);
  if (!r) notFound();
  return <EosbEditor doc={plain(r)} employees={lk.employees} defaultEmployeeId={r.employeeId} perms={perms} />;
}
