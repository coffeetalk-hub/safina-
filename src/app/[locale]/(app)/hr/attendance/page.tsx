import { hrPage, type SP } from "@/modules/hr/page-helpers";
import { financeLookups } from "@/modules/finance/_shared/lookups";
import { listAttendance, attendanceColumns } from "@/modules/hr/attendance";
import { saveAttendanceAction, removeAttendanceAction } from "@/modules/hr/actions";
import { enumOptions } from "@/modules/foundation/_shared/lookups";
import { PageHeader } from "@/components/shell/page-header";
import { CrudList } from "@/components/forms/crud-list";
import { plain } from "@/components/data-table/types";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { GenerateMonth } from "./client";

export default async function AttendancePage({ searchParams }: { searchParams: SP }) {
  const { session, locale, params, t, tf, te, perms } = await hrPage("attendance", searchParams);
  const [data, lk] = await Promise.all([listAttendance(session, params), financeLookups(session.companyId, locale)]);
  const month = params.filters.month || new Date().toISOString().slice(0, 7);
  return (
    <>
      <PageHeader title={t("attendance.title")} description={t("attendance.hint")} actions={perms.allEmployees && <Button variant="outline" asChild><Link href="/hr/settings?tab=holidays">{t("holidays.title")}</Link></Button>} />
      <CrudList tableKey="hr-attendance" columns={attendanceColumns(tf, t)} data={plain(data)} exportResource="hr-attendance" dialogSize="md" dateFields={["day"]}
        extraToolbar={perms.allEmployees && perms.create ? <GenerateMonth month={month} /> : undefined}
        filters={[
          { key: "month", label: tf("period"), type: "text" },
          ...(perms.allEmployees ? [{ key: "employeeId", label: t("employee"), type: "select" as const, options: lk.employees }] : []),
          { key: "status", label: tf("status"), type: "select", options: enumOptions(te, "AttendanceStatus", ["PRESENT", "ABSENT", "LEAVE", "REMOTE", "HOLIDAY", "WEEKEND"]) },
        ]}
        titleNew={t("attendance.new")} titleEdit={t("attendance.edit")}
        newDefaults={{ employeeId: "", day: new Date().toISOString().slice(0, 10), status: "PRESENT", checkIn: "08:00", checkOut: "17:00", overtimeHrs: 0, notes: "" }}
        fields={[
          { name: "employeeId", label: t("employee"), type: "select", options: lk.employees, required: true, colSpan: 2 },
          { name: "day", label: tf("date"), type: "date", required: true },
          { name: "status", label: tf("status"), type: "select", options: enumOptions(te, "AttendanceStatus", ["PRESENT", "ABSENT", "LEAVE", "REMOTE", "HOLIDAY", "WEEKEND"]), required: true },
          { name: "checkIn", label: t("checkIn"), dir: "ltr", placeholder: "08:00" }, { name: "checkOut", label: t("checkOut"), dir: "ltr", placeholder: "17:00" },
          { name: "overtimeHrs", label: t("overtimeHrs"), type: "number", step: "0.5", description: t("attendance.overtimeHint") }, { name: "notes", label: tf("notes") },
        ]}
        saveAction={saveAttendanceAction} removeAction={removeAttendanceAction} can={{ ...perms, edit: perms.create }} />
    </>
  );
}
