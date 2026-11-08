"use server";

import { runAction } from "@/core/action";
import { customers, customerSchema } from "./service";

export async function saveCustomer(input: unknown) {
  const isEdit = Boolean((input as { id?: string })?.id);
  return runAction({ permission: `foundation.customer:${isEdit ? "edit" : "create"}`, schema: customerSchema }, input, (data, s) => customers.save(s, data));
}

export async function removeCustomer(id: string) {
  return runAction({ permission: "foundation.customer:delete" }, null, (_d, s) => customers.remove(s, id));
}
