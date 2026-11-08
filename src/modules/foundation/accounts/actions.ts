"use server";

import { z } from "zod";
import { runAction } from "@/core/action";
import { accounts, accountSchema, saveMappings } from "./service";

export async function saveAccount(input: unknown) {
  const isEdit = Boolean((input as { id?: string })?.id);
  return runAction({ permission: `foundation.account:${isEdit ? "edit" : "create"}`, schema: accountSchema }, input, (data, s) => accounts.save(s, data));
}
export async function removeAccount(id: string) {
  return runAction({ permission: "foundation.account:delete" }, null, (_d, s) => accounts.remove(s, id));
}
export async function saveAccountMappings(input: unknown) {
  return runAction({ permission: "foundation.account:edit", schema: z.record(z.string(), z.string().nullable()) }, input, (data, s) => saveMappings(s, data));
}
