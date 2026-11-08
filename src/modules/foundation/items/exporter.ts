import { crudExporter } from "@/core/export/registry";
import { items, itemColumns } from "./service";

export const exporter = crudExporter({ permission: "foundation.item:view", columns: itemColumns, load: (s, p) => items.all(s, p), sheetAr: "الأصناف والخدمات", sheetEn: "Items" });
