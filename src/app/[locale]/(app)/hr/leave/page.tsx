import { hrPage, type SP } from "@/modules/hr/page-helpers";
import { financeLookups } from "@/modules/finance/_shared/lookups";
import { listLeave, leaveColumns } from "@/modules/hr/leave";
import { leaveTypes } from "@/modules/hr/settings";
import { enumOptions } from "@/modules/foundation/_shared/lookups";
import { PageHeader } from "@/components/shell/page-header";
import { DataTable } from "@/components/data-table/data-table";
import { plain, parseListParams } from "@/components/data-table/types";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { Plus } from "lucide-react";

export default async function LeavePage({ searchParams }: { searchParams: SP }) {
  const { session, locale, params, t, tf, te, perms } = await hrPage("leave", searchParams);
  const [data, lk, types] = await Promise.all([listLeave(session, params), financeLookups(session.companyId, locale), leaveTypes.all(session, parseListParams({}))]);
  return (
    <>
      <PageHeader title={t("leave.title")} description={t("leave.hint")} actions={<>
        {perms.allEmployees && <Button variant="outline" asChild><Link href="/hr/leave/balances">{t("balances.title")}</Link></Button>}
        {perms.allEmployees && <Button variant="outline" asChild><Link href="/hr/leave/types">{t("leaveTypes.title")}</Link></Button>}
        {perms.create && <Button asChild><Link href="/hr/leave/new"><Plus /> {t("leave.new")}</Link></Button>}
      </>} />
      <DataTable tableKey="hr-leave" columns={leaveColumns(tf, t)} data={plain(data)} exportResource="hr-leave" rowHrefTemplate="/hr/leave/{id}" filters={[
        { key: "status", label: tf("status"), type: "select", options: enumOptions(te, "LeaveStatus", ["DRAFT", "PENDING_APPROVAL", "APPROVED", "REJECTED", "CANCELLED"]) },
        { key: "leaveTypeId", label: t("leaveType"), type: "select", options: (types as { id: string; nameAr: string; nameEn: string }[]).map((x) => ({ value: x.id, label: locale === "ar" ? x.nameAr : x.nameEn })) },
        ...(perms.allEmployees ? [{ key: "employeeId", label: t("employee"), type: "select" as const, options: lk.employees }] : []),
        { key: "from", label: tf("from"), type: "date" }, { key: "to", label: tf("to"), type: "date" },
      ]} />
    </>
  );
}
