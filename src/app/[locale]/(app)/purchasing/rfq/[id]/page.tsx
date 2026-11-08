import { notFound } from "next/navigation";
import { purchasingPage } from "@/modules/purchasing/page-helpers";
import { financeLookups } from "@/modules/finance/_shared/lookups";
import { compare, getRfq } from "@/modules/purchasing/rfq";
import { listForEntity } from "@/modules/foundation/attachments/service";
import { can } from "@/core/auth/session";
import { plain } from "@/components/data-table/types";
import { RfqEditor } from "./client";

export default async function RfqPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { session, locale, perms } = await purchasingPage("rfq");
  const lk = await financeLookups(session.companyId, locale);
  const canAttach = { upload: can(session, "foundation.attachment:create"), delete: can(session, "foundation.attachment:delete") };
  const canAward = can(session, "purchasing.order:create");
  if (id === "new") return <RfqEditor doc={null} comparison={null} lookups={lk} can={perms} canAward={canAward} attachments={[]} canAttach={canAttach} />;
  const r = await getRfq(session, id);
  if (!r) notFound();
  const attachments = await listForEntity(session.companyId, "Rfq", id);
  return <RfqEditor doc={plain(r)} comparison={plain(compare(r))} lookups={lk} can={perms} canAward={canAward} attachments={plain(attachments)} canAttach={canAttach} />;
}
