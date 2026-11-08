import { notFound } from "next/navigation";
import { purchasingPage } from "@/modules/purchasing/page-helpers";
import { financeLookups, requesterLookups } from "@/modules/finance/_shared/lookups";
import { getRequest } from "@/modules/purchasing/requests";
import { myEmployee } from "@/modules/hr/employees";
import { listForEntity } from "@/modules/foundation/attachments/service";
import { can } from "@/core/auth/session";
import { plain } from "@/components/data-table/types";
import { RequestEditor } from "./client";

export default async function RequestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { session, locale, perms, ownOnly } = await purchasingPage("request", undefined, { ownResource: "myRequest" });
  const all = await financeLookups(session.companyId, locale);
  const lk = ownOnly ? requesterLookups(all, (await myEmployee(session))?.id ?? null) : all;
  const canAttach = { upload: !ownOnly && can(session, "foundation.attachment:create"), delete: !ownOnly && can(session, "foundation.attachment:delete") };
  const extra = { rfq: can(session, "purchasing.rfq:create"), order: can(session, "purchasing.order:create") };
  if (id === "new") return <RequestEditor doc={null} lookups={lk} can={perms} extra={extra} attachments={[]} canAttach={canAttach} />;
  const r = await getRequest(session, id);
  if (!r) notFound();
  const attachments = ownOnly ? [] : await listForEntity(session.companyId, "PurchaseRequest", id);
  return <RequestEditor doc={plain(r)} lookups={lk} can={perms} extra={extra} attachments={plain(attachments)} canAttach={canAttach} />;
}
