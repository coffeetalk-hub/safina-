import { crudExporter } from "@/core/export/registry";
import { customers } from "./service";
import { customerColumns } from "./columns";

export const exporter = crudExporter({
  permission: "foundation.customer:view",
  columns: customerColumns,
  load: (s, p) => customers.all(s, p),
  sheetAr: "العملاء",
  sheetEn: "Customers",
});
