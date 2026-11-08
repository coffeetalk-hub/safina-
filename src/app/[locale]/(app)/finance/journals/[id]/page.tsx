import { notFound } from "next/navigation";
import { financePage } from "@/modules/finance/_shared/page-helpers";
import { financeLookups } from "@/modules/finance/_shared/lookups";
import { getJournal } from "@/modules/finance/journals/service";
import { plain } from "@/components/data-table/types";
import { JournalEditor } from "./editor";
import { listForEntity } from "@/modules/foundation/attachments/service";
import { can } from "@/core/auth/session";

export default async function JournalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { session, locale, perms } = await financePage("journal");
  const lk = await financeLookups(session.companyId, locale);
  if (id === "new") {
    return <JournalEditor entry={null} lookups={lk} can={perms} attachments={[]} canAttach={{ upload: false, delete: false }} />;
  }
  const entry = await getJournal(session, id);
  if (!entry) notFound();
  const attachments = await listForEntity(session.companyId, "JournalEntry", id);
  return (
    <JournalEditor
      entry={plain(entry)}
      lookups={lk}
      can={perms}
      attachments={plain(attachments)}
      canAttach={{ upload: can(session, "foundation.attachment:create"), delete: can(session, "foundation.attachment:delete") }}
    />
  );
}
