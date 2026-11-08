"use server";

import { runAction } from "@/core/action";
import { branches, branchSchema } from "./service";

export async function saveBranch(input: unknown) {
  const isEdit = Boolean((input as { id?: string })?.id);
  return runAction({ permission: `foundation.branch:${isEdit ? "edit" : "create"}`, schema: branchSchema }, input, (data, s) => branches.save(s, data));
}
export async function removeBranch(id: string) {
  return runAction({ permission: "foundation.branch:delete" }, null, (_d, s) => branches.remove(s, id));
}
