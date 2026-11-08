"use server";

import { z } from "zod";
import { runAction } from "@/core/action";
import { plain } from "@/components/data-table/types";
import { cancelInvoice, createCreditNote, invoiceSchema, postInvoice, reverseInvoice, saveInvoice, submitToZatca } from "./invoices";
import { deleteReceiptDraft, openInvoices, postReceipt, receiptSchema, reverseReceipt, saveReceipt } from "./receipts";

export async function saveInvoiceAction(input: unknown) {
  const isEdit = Boolean((input as { id?: string })?.id);
  return runAction({ permission: `finance.invoice:${isEdit ? "edit" : "create"}`, schema: invoiceSchema }, input, async (d, s) => {
    const inv = await saveInvoice(s, d);
    return { id: inv.id, number: inv.number };
  });
}
export async function postInvoiceAction(input: unknown) {
  return runAction({ permission: "finance.invoice:edit", schema: z.object({ id: z.string(), overrideCredit: z.boolean().optional() }) }, input, (d, s) => {
    if (d.overrideCredit && !s.permissions.has("*") && !s.permissions.has("finance.invoice:approve")) throw new Error("FORBIDDEN");
    return postInvoice(s, d.id, { overrideCredit: d.overrideCredit });
  });
}
export async function cancelInvoiceAction(id: string) {
  return runAction({ permission: "finance.invoice:edit" }, null, (_d, s) => cancelInvoice(s, id));
}
export async function reverseInvoiceAction(id: string) {
  return runAction({ permission: "finance.invoice:approve" }, null, (_d, s) => reverseInvoice(s, id));
}
export async function creditNoteAction(id: string) {
  return runAction({ permission: "finance.invoice:create" }, null, async (_d, s) => {
    const cn = await createCreditNote(s, id);
    return { id: cn.id };
  });
}
export async function submitZatcaAction(id: string) {
  return runAction({ permission: "finance.zatca:create" }, null, (_d, s) => submitToZatca(s, id));
}
export async function saveReceiptAction(input: unknown) {
  const isEdit = Boolean((input as { id?: string })?.id);
  return runAction({ permission: `finance.receipt:${isEdit ? "edit" : "create"}`, schema: receiptSchema }, input, async (d, s) => {
    const r = await saveReceipt(s, d);
    return { id: r.id, number: r.number };
  });
}
export async function postReceiptAction(id: string) {
  return runAction({ permission: "finance.receipt:edit" }, null, (_d, s) => postReceipt(s, id));
}
export async function reverseReceiptAction(id: string) {
  return runAction({ permission: "finance.receipt:approve" }, null, (_d, s) => reverseReceipt(s, id));
}
export async function deleteReceiptAction(id: string) {
  return runAction({ permission: "finance.receipt:delete" }, null, (_d, s) => deleteReceiptDraft(s, id));
}
export async function openInvoicesAction(customerId: string, receiptId?: string) {
  return runAction({ permission: "finance.receipt:view" }, null, async (_d, s) => plain(await openInvoices(s, customerId, receiptId)));
}
