"use server";

import { runAction } from "@/core/action";
import { items, itemSchema } from "./service";

export async function saveItem(input: unknown) {
  const isEdit = Boolean((input as { id?: string })?.id);
  return runAction({ permission: `foundation.item:${isEdit ? "edit" : "create"}`, schema: itemSchema }, input, (data, s) => items.save(s, data));
}
export async function removeItem(id: string) {
  return runAction({ permission: "foundation.item:delete" }, null, (_d, s) => items.remove(s, id));
}
