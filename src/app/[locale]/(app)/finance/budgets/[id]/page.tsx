import { notFound } from "next/navigation";
import { financePage, type SP } from "@/modules/finance/_shared/page-helpers";
import { financeLookups } from "@/modules/finance/_shared/lookups";
import { getBudget, varianceReport } from "@/modules/finance/budgets/service";
import { plain } from "@/components/data-table/types";
import { prisma } from "@/lib/prisma";
import { BudgetEditor } from "./editor";

export default async function BudgetPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SP }) {
  const { id } = await params;
  const { session, locale, params: p, perms } = await financePage("budget", searchParams);
  const [lk, years] = await Promise.all([financeLookups(session.companyId, locale), prisma.fiscalYear.findMany({ where: { companyId: session.companyId }, orderBy: { startDate: "desc" }, select: { id: true, name: true } })]);
  const yearOpts = years.map((y) => ({ value: y.id, label: y.name }));
  if (id === "new") return <BudgetEditor budget={null} lookups={lk} years={yearOpts} can={perms} variance={null} />;
  const b = await getBudget(session, id);
  if (!b) notFound();
  const fromM = Number(p.filters.fromMonth || 1);
  const toM = Number(p.filters.toMonth || 12);
  const v = await varianceReport(session, id, fromM, toM, p.filters.costCenterId || undefined);
  return <BudgetEditor budget={plain(b)} lookups={lk} years={yearOpts} can={perms} variance={{ rows: v.rows, fromMonth: fromM, toMonth: toM, costCenterId: p.filters.costCenterId ?? "" }} />;
}
