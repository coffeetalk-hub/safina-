"use server";

import { runAction } from "@/core/action";
import { companySchema, saveCompany } from "./service";

export async function saveCompanyAction(input: unknown) {
  const isEdit = Boolean((input as { id?: string })?.id);
  return runAction({ permission: `foundation.company:${isEdit ? "edit" : "create"}`, schema: companySchema }, input, (data, s) => saveCompany(s, data));
}
