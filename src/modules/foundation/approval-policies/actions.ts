"use server";

import { runAction } from "@/core/action";
import { policySchema, removePolicy, savePolicy } from "./service";

export async function savePolicyAction(input: unknown) {
  const isEdit = Boolean((input as { id?: string })?.id);
  return runAction({ permission: `foundation.approval:${isEdit ? "edit" : "create"}`, schema: policySchema }, input, (d, s) => savePolicy(s, d));
}
export async function removePolicyAction(id: string) {
  return runAction({ permission: "foundation.approval:delete" }, null, (_d, s) => removePolicy(s, id));
}
