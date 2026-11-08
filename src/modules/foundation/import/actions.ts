"use server";

import { runAction } from "@/core/action";
import { runImport } from "@/core/import";
import { IMPORTS } from "./definitions";
import { postOpeningBalances } from "./opening";
import "@/modules/finance/register";

export async function importAction(formData: FormData) {
  const entity = String(formData.get("entity") ?? "");
  const file = formData.get("file");
  const def = IMPORTS[entity];
  if (!def) return { ok: false as const, error: "NOT_FOUND" };
  return runAction({ permission: def.permission }, null, async (_d, s) => {
    if (!(file instanceof File) || file.size === 0) throw new Error("INVALID_FILE");
    const buf = Buffer.from(await file.arrayBuffer());
    if (entity === "opening-balances") return postOpeningBalances(s, def, buf, file.name);
    return runImport(def, s, buf, file.name);
  });
}
