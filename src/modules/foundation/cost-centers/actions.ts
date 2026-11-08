"use server";

import { runAction } from "@/core/action";
import { costCenters, costCenterSchema } from "./service";

export async function saveCostCenter(input: unknown) {
  const isEdit = Boolean((input as { id?: string })?.id);
  return runAction({ permission: `foundation.costCenter:${isEdit ? "edit" : "create"}`, schema: costCenterSchema }, input, (data, s) => costCenters.save(s, data));
}
export async function removeCostCenter(id: string) {
  return runAction({ permission: "foundation.costCenter:delete" }, null, (_d, s) => costCenters.remove(s, id));
}
