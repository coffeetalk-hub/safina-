import { SERVERLESS_BUILD } from "@/lib/hosting";

export type StorageDriver = "disk" | "database";

/** Where file bytes live. STORAGE_DRIVER wins when set; otherwise "database" on serverless builds and "disk" elsewhere. */
export function storageDriver(): StorageDriver {
  const chosen = process.env.STORAGE_DRIVER;
  if (chosen === "disk" || chosen === "database") return chosen;
  return SERVERLESS_BUILD ? "database" : "disk";
}
