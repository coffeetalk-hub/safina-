import { listPage, type SP } from "@/modules/foundation/_shared/page-helpers";
import { lookups, enumOptions } from "@/modules/foundation/_shared/lookups";
import { employees, employeeColumns } from "@/modules/foundation/employees/service";
import { saveEmployee, removeEmployee } from "@/modules/foundation/employees/actions";
import { PageHeader } from "@/components/shell/page-header";
import { CrudList } from "@/components/forms/crud-list";
import type { FieldConfig } from "@/components/forms/entity-dialog";
import { plain } from "@/components/data-table/types";
import { prisma } from "@/lib/prisma";
import { COUNTRIES } from "@/lib/countries";

export default async function EmployeesPage({ searchParams }: { searchParams: SP }) {
  const { session, locale, params, t, tf, te, perms } = await listPage("employee", searchParams);
  const [data, lk, managers] = await Promise.all([
    employees.list(session, params),
    lookups(session.companyId, locale),
    prisma.employee.findMany({ where: { companyId: session.companyId, isActive: true }, select: { id: true, code: true, firstNameAr: true, lastNameAr: true, firstNameEn: true, lastNameEn: true }, orderBy: { code: "asc" } }),
  ]);
  const statuses = enumOptions(te, "EmployeeStatus", ["ACTIVE", "ON_LEAVE", "SUSPENDED", "TERMINATED"]);
  const countries = COUNTRIES.map((c) => ({ value: c.code, label: locale === "ar" ? c.ar : c.en }));

  const fields: FieldConfig[] = [
    { name: "code", label: tf("code"), placeholder: "auto", dir: "ltr" },
    { name: "status", label: tf("employeeStatus"), type: "select", options: statuses, required: true },
    { name: "firstNameAr", label: tf("firstNameAr"), required: true, dir: "rtl" },
    { name: "lastNameAr", label: tf("lastNameAr"), required: true, dir: "rtl" },
    { name: "firstNameEn", label: tf("firstNameEn"), required: true, dir: "ltr" },
    { name: "lastNameEn", label: tf("lastNameEn"), required: true, dir: "ltr" },
    { name: "gender", label: tf("gender"), type: "select", options: enumOptions(te, "Gender", ["MALE", "FEMALE"]), required: true },
    { name: "nationality", label: tf("nationality"), type: "select", options: countries, required: true },
    { name: "nationalId", label: tf("nationalId"), dir: "ltr" },
    { name: "dateOfBirth", label: tf("dateOfBirth"), type: "date" },
    { name: "email", label: tf("email"), type: "email" },
    { name: "phone", label: tf("phone"), dir: "ltr" },
    { name: "jobTitleAr", label: tf("jobTitleAr"), dir: "rtl" },
    { name: "jobTitleEn", label: tf("jobTitleEn"), dir: "ltr" },
    { name: "department", label: tf("department") },
    { name: "managerId", label: tf("manager"), type: "select", options: managers.map((m) => ({ value: m.id, label: `${m.code} · ${locale === "ar" ? `${m.firstNameAr} ${m.lastNameAr}` : `${m.firstNameEn} ${m.lastNameEn}`}` })) },
    { name: "branchId", label: tf("branch"), type: "select", options: lk.branches },
    { name: "costCenterId", label: tf("costCenter"), type: "select", options: lk.costCenters },
    { name: "hireDate", label: tf("hireDate"), type: "date" },
    { name: "terminationDate", label: tf("terminationDate"), type: "date", visibleWhen: { field: "status", equals: "TERMINATED" } },
    { name: "bankName", label: tf("bankName") },
    { name: "iban", label: tf("iban"), dir: "ltr" },
    { name: "gosiNumber", label: tf("gosiNumber"), dir: "ltr" },
    { name: "isSalesperson", label: tf("isSalesperson"), type: "switch" },
    { name: "addressAr", label: tf("addressAr"), dir: "rtl" },
    { name: "addressEn", label: tf("addressEn"), dir: "ltr" },
  ];

  return (
    <>
      <PageHeader title={t("employees.title")} />
      <CrudList
        tableKey="employees"
        columns={employeeColumns(tf, locale)}
        data={plain(data)}
        exportResource="employees"
        filters={[
          { key: "status", label: tf("employeeStatus"), type: "select", options: statuses },
          { key: "branchId", label: tf("branch"), type: "select", options: lk.branches },
          { key: "isSaudi", label: tf("isSaudi"), type: "boolean" },
        ]}
        fields={fields}
        titleNew={t("employees.new")}
        titleEdit={t("employees.edit")}
        newDefaults={{ status: "ACTIVE", gender: "MALE", nationality: "SA", isSaudi: true, isSalesperson: false, isActive: true }}
        dateFields={["dateOfBirth", "hireDate", "terminationDate"]}
        saveAction={saveEmployee}
        removeAction={removeEmployee}
        can={perms}
        dialogSize="xl"
      />
    </>
  );
}
