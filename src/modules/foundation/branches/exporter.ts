import { crudExporter } from "@/core/export/registry";
import { branches, branchColumns } from "./service";

export const exporter = crudExporter({ permission: "foundation.branch:view", columns: (tf) => branchColumns(tf), load: (s, p) => branches.all(s, p), sheetAr: "الفروع", sheetEn: "Branches" });
