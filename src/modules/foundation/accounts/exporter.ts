import { crudExporter } from "@/core/export/registry";
import { accounts, accountColumns } from "./service";

export const exporter = crudExporter({ permission: "foundation.account:view", columns: (tf) => accountColumns(tf), load: (s, p) => accounts.all(s, p), sheetAr: "دليل الحسابات", sheetEn: "Chart of accounts" });
