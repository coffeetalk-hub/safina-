"use server";

import { z } from "zod";
import { runAction } from "@/core/action";
import { prisma } from "@/lib/prisma";
import { bankAccounts, bankAccountSchema, importStatement, matchLine, autoMatch, completeReconciliation, deleteStatementLine } from "./bank/service";
import { funds, fundSchema, voucherSchema, saveVoucher, postVoucher, reverseVoucher, deleteVoucher } from "./petty-cash/service";
import { categories, categorySchema, assetSchema, saveAsset, runDepreciation, disposeAsset } from "./assets/service";
import { saveVatReturn, fileVatReturn } from "./vat/service";
import { budgetSchema, saveBudget, setBudgetStatus, deleteBudget } from "./budgets/service";

// Bank
export async function saveBankAccountAction(input: unknown) {
  const isEdit = Boolean((input as { id?: string })?.id);
  return runAction({ permission: `finance.bank:${isEdit ? "edit" : "create"}`, schema: bankAccountSchema }, input, (d, s) => bankAccounts.save(s, d));
}
export async function removeBankAccountAction(id: string) {
  return runAction({ permission: "finance.bank:delete" }, null, (_d, s) => bankAccounts.remove(s, id));
}
export async function importStatementAction(formData: FormData) {
  const bankAccountId = String(formData.get("bankAccountId") ?? "");
  const file = formData.get("file");
  return runAction({ permission: "finance.reconciliation:create" }, null, async (_d, s) => {
    if (!(file instanceof File) || file.size === 0) throw new Error("INVALID_FILE");
    return importStatement(s, bankAccountId, Buffer.from(await file.arrayBuffer()), file.name);
  });
}
export async function matchLineAction(statementLineId: string, entryId: string | null) {
  return runAction({ permission: "finance.reconciliation:edit" }, null, (_d, s) => matchLine(s, statementLineId, entryId));
}
export async function autoMatchAction(bankAccountId: string, asOf: string) {
  return runAction({ permission: "finance.reconciliation:edit" }, null, (_d, s) => autoMatch(s, bankAccountId, new Date(asOf)));
}
export async function completeReconciliationAction(input: unknown) {
  return runAction({ permission: "finance.reconciliation:approve", schema: z.object({ bankAccountId: z.string(), statementDate: z.string(), statementBalance: z.coerce.number(), notes: z.string().nullable().optional() }) }, input, (d, s) => completeReconciliation(s, d));
}
export async function deleteStatementLineAction(id: string) {
  return runAction({ permission: "finance.reconciliation:delete" }, null, (_d, s) => deleteStatementLine(s, id));
}

// Petty cash
export async function saveFundAction(input: unknown) {
  const isEdit = Boolean((input as { id?: string })?.id);
  return runAction({ permission: `finance.pettyCash:${isEdit ? "edit" : "create"}`, schema: fundSchema }, input, (d, s) => funds.save(s, d));
}
export async function removeFundAction(id: string) {
  return runAction({ permission: "finance.pettyCash:delete" }, null, (_d, s) => funds.remove(s, id));
}
export async function saveVoucherAction(input: unknown) {
  const isEdit = Boolean((input as { id?: string })?.id);
  return runAction({ permission: `finance.pettyCash:${isEdit ? "edit" : "create"}`, schema: voucherSchema }, input, (d, s) => saveVoucher(s, d));
}
export async function postVoucherAction(id: string) {
  return runAction({ permission: "finance.pettyCash:edit" }, null, (_d, s) => postVoucher(s, id));
}
export async function reverseVoucherAction(id: string) {
  return runAction({ permission: "finance.pettyCash:approve" }, null, (_d, s) => reverseVoucher(s, id));
}
export async function deleteVoucherAction(id: string) {
  return runAction({ permission: "finance.pettyCash:delete" }, null, (_d, s) => deleteVoucher(s, id));
}

// Assets
export async function saveCategoryAction(input: unknown) {
  const isEdit = Boolean((input as { id?: string })?.id);
  return runAction({ permission: `finance.asset:${isEdit ? "edit" : "create"}`, schema: categorySchema }, input, (d, s) => categories.save(s, d));
}
export async function removeCategoryAction(id: string) {
  return runAction({ permission: "finance.asset:delete" }, null, (_d, s) => categories.remove(s, id));
}
export async function saveAssetAction(input: unknown) {
  const isEdit = Boolean((input as { id?: string })?.id);
  return runAction({ permission: `finance.asset:${isEdit ? "edit" : "create"}`, schema: assetSchema }, input, async (d, s) => {
    const a = await saveAsset(s, d);
    return { id: a.id };
  });
}
export async function removeAssetAction(id: string) {
  return runAction({ permission: "finance.asset:delete" }, null, async (_d, s) => {
    const a = await prisma.fixedAsset.findFirst({ where: { id, companyId: s.companyId } });
    if (!a) throw new Error("NOT_FOUND");
    if (Number(a.accumulated) !== 0) throw new Error("HAS_DEPRECIATION");
    return prisma.fixedAsset.delete({ where: { id } });
  });
}
export async function runDepreciationAction(month: string) {
  return runAction({ permission: "finance.asset:approve" }, null, (_d, s) => runDepreciation(s.companyId, s.userId, new Date(month + "-01")));
}
export async function disposeAssetAction(input: unknown) {
  return runAction({ permission: "finance.asset:approve", schema: z.object({ id: z.string(), disposalDate: z.string(), disposalAmount: z.coerce.number().min(0), proceedsAccountId: z.string().nullable().optional() }) }, input, (d, s) => disposeAsset(s, d));
}

// VAT
export async function saveVatReturnAction(input: unknown) {
  return runAction({ permission: "finance.vat:create", schema: z.object({ from: z.string(), to: z.string() }) }, input, async (d, s) => {
    const r = await saveVatReturn(s, new Date(d.from), new Date(d.to));
    return { id: r.id };
  });
}
export async function fileVatReturnAction(id: string) {
  return runAction({ permission: "finance.vat:approve" }, null, (_d, s) => fileVatReturn(s, id));
}

// Budgets
export async function saveBudgetAction(input: unknown) {
  const isEdit = Boolean((input as { id?: string })?.id);
  return runAction({ permission: `finance.budget:${isEdit ? "edit" : "create"}`, schema: budgetSchema }, input, async (d, s) => {
    const b = await saveBudget(s, d);
    return { id: b.id };
  });
}
export async function setBudgetStatusAction(id: string, status: "DRAFT" | "APPROVED") {
  return runAction({ permission: "finance.budget:approve" }, null, (_d, s) => setBudgetStatus(s, id, status));
}
export async function deleteBudgetAction(id: string) {
  return runAction({ permission: "finance.budget:delete" }, null, (_d, s) => deleteBudget(s, id));
}
