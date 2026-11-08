"use server";

import { runAction } from "@/core/action";
import { fiscalYearSchema, saveFiscalYear, setPeriodStatus, setYearStatus } from "./service";

export async function saveFiscalYearAction(input: unknown) {
  const isEdit = Boolean((input as { id?: string })?.id);
  return runAction({ permission: `foundation.fiscal:${isEdit ? "edit" : "create"}`, schema: fiscalYearSchema }, input, (d, s) => saveFiscalYear(s, d));
}
export async function setPeriodStatusAction(periodId: string, status: "OPEN" | "CLOSED" | "LOCKED") {
  return runAction({ permission: "foundation.fiscal:approve" }, null, (_d, s) => setPeriodStatus(s, periodId, status));
}
export async function setYearStatusAction(yearId: string, status: "OPEN" | "CLOSED" | "LOCKED") {
  return runAction({ permission: "foundation.fiscal:approve" }, null, (_d, s) => setYearStatus(s, yearId, status));
}
