"use server";

import { runAction } from "@/core/action";
import { removeRole, roleSchema, saveRole } from "./service";

export async function saveRoleAction(input: unknown) {
  const isEdit = Boolean((input as { id?: string })?.id);
  return runAction({ permission: `foundation.role:${isEdit ? "edit" : "create"}`, schema: roleSchema }, input, (d, s) => saveRole(s, d));
}
export async function removeRoleAction(id: string) {
  return runAction({ permission: "foundation.role:delete" }, null, (_d, s) => removeRole(s, id));
}
