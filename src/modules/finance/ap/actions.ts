"use server";

import { runAction } from "@/core/action";
import { plain } from "@/components/data-table/types";
import { billSchema, cancelBill, postBill, reverseBill, saveBill } from "./bills";
import { deletePaymentDraft, openBills, paymentSchema, postPayment, reversePayment, savePayment } from "./payments";

export async function saveBillAction(input: unknown) {
  const isEdit = Boolean((input as { id?: string })?.id);
  return runAction({ permission: `finance.bill:${isEdit ? "edit" : "create"}`, schema: billSchema }, input, async (d, s) => {
    const b = await saveBill(s, d);
    return { id: b.id, number: b.number };
  });
}
export async function postBillAction(input: unknown) {
  const id = typeof input === "string" ? input : String((input as { id: string }).id);
  return runAction({ permission: "finance.bill:edit" }, null, (_d, s) => postBill(s, id));
}
export async function cancelBillAction(id: string) {
  return runAction({ permission: "finance.bill:edit" }, null, (_d, s) => cancelBill(s, id));
}
export async function reverseBillAction(id: string) {
  return runAction({ permission: "finance.bill:approve" }, null, (_d, s) => reverseBill(s, id));
}
export async function savePaymentAction(input: unknown) {
  const isEdit = Boolean((input as { id?: string })?.id);
  return runAction({ permission: `finance.payment:${isEdit ? "edit" : "create"}`, schema: paymentSchema }, input, async (d, s) => {
    const p = await savePayment(s, d);
    return { id: p.id, number: p.number };
  });
}
export async function postPaymentAction(id: string) {
  return runAction({ permission: "finance.payment:edit" }, null, (_d, s) => postPayment(s, id));
}
export async function reversePaymentAction(id: string) {
  return runAction({ permission: "finance.payment:approve" }, null, (_d, s) => reversePayment(s, id));
}
export async function deletePaymentAction(id: string) {
  return runAction({ permission: "finance.payment:delete" }, null, (_d, s) => deletePaymentDraft(s, id));
}
export async function openBillsAction(vendorId: string, paymentId?: string) {
  return runAction({ permission: "finance.payment:view" }, null, async (_d, s) => plain(await openBills(s, vendorId, paymentId)));
}
