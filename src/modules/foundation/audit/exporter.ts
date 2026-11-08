import { crudExporter } from "@/core/export/registry";
import { allAudit, auditColumns } from "./service";

export const exporter = crudExporter({ permission: "foundation.audit:view", columns: (tf) => auditColumns(tf), load: (s, p) => allAudit(s, p), sheetAr: "سجل التدقيق", sheetEn: "Audit log" });
