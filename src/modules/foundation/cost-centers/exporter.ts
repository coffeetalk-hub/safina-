import { crudExporter } from "@/core/export/registry";
import { costCenters, costCenterColumns } from "./service";

export const exporter = crudExporter({ permission: "foundation.costCenter:view", columns: (tf) => costCenterColumns(tf), load: (s, p) => costCenters.all(s, p), sheetAr: "مراكز التكلفة", sheetEn: "Cost centers" });
