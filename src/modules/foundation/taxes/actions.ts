"use server";

import { runAction } from "@/core/action";
import { taxes, taxSchema } from "./service";

export async function saveTax(input: unknown) {
  const isEdit = Boolean((input as { id?: string })?.id);
  return runAction({ permission: `foundation.tax:${isEdit ? "edit" : "create"}`, schema: taxSchema }, input, (data, s) => taxes.save(s, data));
}
export async function removeTax(id: string) {
  return runAction({ permission: "foundation.tax:delete" }, null, (_d, s) => taxes.remove(s, id));
}
