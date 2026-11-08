"use server";

import { runAction } from "@/core/action";
import { vendors, vendorSchema } from "./service";

export async function saveVendor(input: unknown) {
  const isEdit = Boolean((input as { id?: string })?.id);
  return runAction({ permission: `foundation.vendor:${isEdit ? "edit" : "create"}`, schema: vendorSchema }, input, (data, s) => vendors.save(s, data));
}
export async function removeVendor(id: string) {
  return runAction({ permission: "foundation.vendor:delete" }, null, (_d, s) => vendors.remove(s, id));
}
