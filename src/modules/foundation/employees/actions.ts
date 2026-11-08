"use server";

import { runAction } from "@/core/action";
import { employees, employeeSchema } from "./service";

export async function saveEmployee(input: unknown) {
  const isEdit = Boolean((input as { id?: string })?.id);
  return runAction({ permission: `foundation.employee:${isEdit ? "edit" : "create"}`, schema: employeeSchema }, input, (data, s) => employees.save(s, data));
}
export async function removeEmployee(id: string) {
  return runAction({ permission: "foundation.employee:delete" }, null, (_d, s) => employees.remove(s, id));
}
