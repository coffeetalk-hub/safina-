import { notFound } from "next/navigation";
import { salesPage } from "@/modules/sales/page-helpers";
import { financeLookups } from "@/modules/finance/_shared/lookups";
import { getOpportunity, ensureStages } from "@/modules/sales/crm";
import { prisma } from "@/lib/prisma";
import { plain } from "@/components/data-table/types";
import { OpportunityDetail } from "./client";
import { listForEntity } from "@/modules/foundation/attachments/service";
import { can } from "@/core/auth/session";

export default async function OpportunityPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { session, locale, perms } = await salesPage("opportunity");
  await ensureStages(session.companyId);
  const [opp, lk, stages, users, attachments] = await Promise.all([getOpportunity(session, id), financeLookups(session.companyId, locale), prisma.pipelineStage.findMany({ where: { companyId: session.companyId, isActive: true }, orderBy: { order: "asc" } }), prisma.user.findMany({ where: { isActive: true, companies: { some: { companyId: session.companyId } } }, select: { id: true, nameAr: true, nameEn: true } }), listForEntity(session.companyId, "Opportunity", id)]);
  if (!opp) notFound();
  return <OpportunityDetail opp={plain(opp)} lookups={lk} stages={stages.map((s) => ({ value: s.id, label: locale === "ar" ? s.nameAr : s.nameEn }))} users={users.map((u) => ({ value: u.id, label: locale === "ar" ? u.nameAr : u.nameEn }))} can={perms} canQuote={can(session, "sales.quotation:create")} attachments={plain(attachments)} canAttach={{ upload: can(session, "foundation.attachment:create"), delete: can(session, "foundation.attachment:delete") }} />;
}
