import { listPage, type SP } from "@/modules/foundation/_shared/page-helpers";
import { listAttachments, attachmentColumns } from "@/modules/foundation/attachments/service";
import { PageHeader } from "@/components/shell/page-header";
import { DataTable } from "@/components/data-table/data-table";
import { plain } from "@/components/data-table/types";
import { prisma } from "@/lib/prisma";

export default async function AttachmentsPage({ searchParams }: { searchParams: SP }) {
  const { session, params, t, tf } = await listPage("attachment", searchParams);
  const [data, types] = await Promise.all([listAttachments(session, params), prisma.attachment.findMany({ where: { companyId: session.companyId }, distinct: ["entityType"], select: { entityType: true } })]);
  return (
    <>
      <PageHeader title={t("attachments.title")} />
      <DataTable tableKey="attachments" columns={attachmentColumns(tf)} data={plain(data)} filters={[{ key: "entityType", label: tf("entity"), type: "select", options: types.map((x) => ({ value: x.entityType, label: x.entityType })) }]} />
    </>
  );
}
