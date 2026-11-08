import { listPage, type SP } from "@/modules/foundation/_shared/page-helpers";
import { IMPORTS } from "@/modules/foundation/import/definitions";
import { PageHeader } from "@/components/shell/page-header";
import { prisma } from "@/lib/prisma";
import { can } from "@/core/auth/session";
import { ImportClient } from "./client";

export default async function ImportPage({ searchParams }: { searchParams: SP }) {
  const { session, t } = await listPage("import", searchParams);
  const history = await prisma.importJob.findMany({ where: { companyId: session.companyId }, orderBy: { createdAt: "desc" }, take: 20 });
  const entities = Object.values(IMPORTS)
    .filter((d) => can(session, d.permission))
    .map((d) => d.entity);
  return (
    <>
      <PageHeader title={t("import.title")} description={t("import.intro")} />
      <ImportClient entities={entities} history={history.map((h) => ({ id: h.id, entityType: h.entityType, fileName: h.fileName, totalRows: h.totalRows, successRows: h.successRows, errorRows: h.errorRows, createdAt: h.createdAt.toISOString() }))} />
    </>
  );
}
