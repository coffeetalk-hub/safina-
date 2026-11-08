import { notFound } from "next/navigation";
import { purchasingPage } from "@/modules/purchasing/page-helpers";
import { financeLookups } from "@/modules/finance/_shared/lookups";
import { getRequest } from "@/modules/purchasing/requests";
import { listForEntity } from "@/modules/foundation/attachments/service";
import { can } from "@/core/auth/session";
import { plain } from "@/components/data-table/types";
import { RequestEditor } from "./client";

export default async function RequestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { session, locale, perms } = await purchasingPage("request");
  const lk = await financeLookups(session.companyId, locale);
  const canAttach = { upload: can(session, "foundation.attachment:create"), delete: can(session, "foundation.attachment:delete") };
  const extra = { rfq: can(session, "purchasing.rfq:create"), order: can(session, "purchasing.order:create") };
  if (id === "new") return <RequestEditor doc={null} lookups={lk} can={perms} extra={extra} attachments={[]} canAttach={canAttach} />;
  const r = await getRequest(session, id);
  if (!r) notFound();
  const attachments = await listForEntity(session.companyId, "PurchaseRequest", id);
  return <RequestEditor doc={plain(r)} lookups={lk} can={perms} extra={extra} attachments={plain(attachments)} canAttach={canAttach} />;
}
