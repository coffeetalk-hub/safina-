"use server";

import { runAction } from "@/core/action";
import { addRate, currencySchema, enableCurrency, rateSchema, toggleCurrency } from "./service";

export async function enableCurrencyAction(input: unknown) {
  return runAction({ permission: "foundation.currency:create", schema: currencySchema }, input, (d, s) => enableCurrency(s, d));
}
export async function toggleCurrencyAction(code: string, isActive: boolean) {
  return runAction({ permission: "foundation.currency:edit" }, null, (_d, s) => toggleCurrency(s, code, isActive));
}
export async function addRateAction(input: unknown) {
  return runAction({ permission: "foundation.currency:edit", schema: rateSchema }, input, (d, s) => addRate(s, d));
}
