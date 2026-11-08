import { crudExporter } from "@/core/export/registry";
import { allUsers, userColumns } from "./service";

export const exporter = crudExporter({ permission: "foundation.user:view", columns: (tf) => userColumns(tf), load: (s, p, locale) => allUsers(s, p, locale), sheetAr: "المستخدمون", sheetEn: "Users" });
