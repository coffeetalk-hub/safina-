import { crudExporter } from "@/core/export/registry";
import { employees, employeeColumns } from "./service";

export const exporter = crudExporter({ permission: "foundation.employee:view", columns: employeeColumns, load: (s, p) => employees.all(s, p), sheetAr: "الموظفون", sheetEn: "Employees" });
