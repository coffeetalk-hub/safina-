import { hrPage, type SP } from "@/modules/hr/page-helpers";
import { leaveTypes, leaveTypeColumns } from "@/modules/hr/settings";
import { saveLeaveTypeAction, removeLeaveTypeAction } from "@/modules/hr/actions";
import { PageHeader } from "@/components/shell/page-header";
import { CrudList } from "@/components/forms/crud-list";
import { plain } from "@/components/data-table/types";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

export default async function LeaveTypesPage({ searchParams }: { searchParams: SP }) {
  const { session, params, t, tf, perms } = await hrPage("leave", searchParams);
  const data = await leaveTypes.list(session, params);
  return (
    <>
      <PageHeader title={t("leaveTypes.title")} description={t("leaveTypes.hint")} actions={<Button variant="ghost" asChild><Link href="/hr/leave">{t("leave.title")}</Link></Button>} />
      <CrudList tableKey="hr-leave-types" columns={leaveTypeColumns(tf, t)} data={plain(data)} exportResource="hr-leave-types" dialogSize="lg"
        titleNew={t("leaveTypes.new")} titleEdit={t("leaveTypes.edit")}
        newDefaults={{ code: "", nameAr: "", nameEn: "", entitlementDays: 0, isPaid: true, payPct: 100, deductsBalance: true, requiresApproval: true, maxDaysPerRequest: "", isActive: true, sortOrder: 10 }}
        fields={[
          { name: "code", label: tf("code"), required: true, dir: "ltr" }, { name: "sortOrder", label: t("sortOrder"), type: "number" },
          { name: "nameAr", label: tf("nameAr"), required: true, dir: "rtl" }, { name: "nameEn", label: tf("nameEn"), required: true, dir: "ltr" },
          { name: "entitlementDays", label: t("entitlementDays"), type: "number", description: t("leaveTypes.entitlementHint") }, { name: "maxDaysPerRequest", label: t("leaveTypes.maxDays"), type: "number" },
          { name: "isPaid", label: t("isPaid"), type: "switch" }, { name: "payPct", label: t("payPct"), type: "number" },
          { name: "deductsBalance", label: t("deductsBalance"), type: "switch" }, { name: "requiresApproval", label: t("requiresApproval"), type: "switch" },
          { name: "isActive", label: tf("isActive"), type: "switch" },
        ]}
        saveAction={saveLeaveTypeAction} removeAction={removeLeaveTypeAction} can={{ create: perms.edit, edit: perms.edit, delete: perms.delete }} />
    </>
  );
}
