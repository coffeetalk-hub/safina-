import { crudExporter } from "@/core/export/registry";
import { vendors, vendorColumns } from "./service";

export const exporter = crudExporter({ permission: "foundation.vendor:view", columns: vendorColumns, load: (s, p) => vendors.all(s, p), sheetAr: "الموردون", sheetEn: "Vendors" });
