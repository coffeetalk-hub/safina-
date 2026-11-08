"use server";

import { z } from "zod";
import { runAction } from "@/core/action";
import { changeOwnPassword, removeUser, saveUser, userSchema } from "./service";

export async function saveUserAction(input: unknown) {
  const isEdit = Boolean((input as { id?: string })?.id);
  return runAction({ permission: `foundation.user:${isEdit ? "edit" : "create"}`, schema: userSchema }, input, (d, s) => saveUser(s, d));
}
export async function removeUserAction(id: string) {
  return runAction({ permission: "foundation.user:delete" }, null, (_d, s) => removeUser(s, id));
}
export async function changePasswordAction(input: unknown) {
  return runAction({ schema: z.object({ currentPassword: z.string().min(1), newPassword: z.string().min(8).max(100) }) }, input, (d, s) => changeOwnPassword(s, d.currentPassword, d.newPassword));
}
