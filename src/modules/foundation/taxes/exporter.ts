import { crudExporter } from "@/core/export/registry";
import { taxes, taxColumns } from "./service";

export const exporter = crudExporter({ permission: "foundation.tax:view", columns: (tf) => taxColumns(tf), load: (s, p) => taxes.all(s, p), sheetAr: "رموز الضريبة", sheetEn: "Tax codes" });
