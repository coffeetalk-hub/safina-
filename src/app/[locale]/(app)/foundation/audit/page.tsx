import { listPage, type SP } from "@/modules/foundation/_shared/page-helpers";
import { lookups, enumOptions } from "@/modules/foundation/_shared/lookups";
import { listAudit, auditColumns, entityNames } from "@/modules/foundation/audit/service";
import { PageHeader } from "@/components/shell/page-header";
import { plain } from "@/components/data-table/types";
import { AuditClient } from "./client";

export default async function AuditPage({ searchParams }: { searchParams: SP }) {
  const { session, locale, params, t, tf, te } = await listPage("audit", searchParams);
  const [data, entities, lk] = await Promise.all([listAudit(session, params), entityNames(session.companyId), lookups(session.companyId, locale)]);
  return (
    <>
      <PageHeader title={t("audit.title")} />
      <AuditClient
        data={plain(data)}
        columns={auditColumns(tf)}
        filters={[
          { key: "entity", label: tf("entity"), type: "select", options: entities.map((e) => ({ value: e, label: e })) },
          { key: "action", label: tf("action"), type: "select", options: enumOptions(te, "AuditAction", ["CREATE", "UPDATE", "DELETE", "LOGIN", "APPROVE", "REJECT", "POST", "REVERSE"]) },
          { key: "userId", label: tf("user"), type: "select", options: lk.users },
          { key: "from", label: tf("from"), type: "date" },
          { key: "to", label: tf("to"), type: "date" },
        ]}
      />
    </>
  );
}
