"use server";

import { z } from "zod";
import { runAction } from "@/core/action";
import { requestSchema, saveRequest, submitRequest, cancelRequest } from "./requests";
import { rfqSchema, saveRfq, rfqFromRequest, setRfqStatus, quoteSchema, saveQuote, awardRfq } from "./rfq";
import { poSchema, savePurchaseOrder, confirmPurchaseOrder, markPoSent, cancelPurchaseOrder, convertPoToBill } from "./orders";
import { contracts, contractSchema } from "./contracts";
import { evaluations, evaluationSchema } from "./evaluations";
import { prisma } from "@/lib/prisma";

export async function saveRequestAction(input: unknown) { const e = Boolean((input as { id?: string })?.id); return runAction({ permission: `purchasing.request:${e ? "edit" : "create"}`, schema: requestSchema }, input, async (d, s) => { const r = await saveRequest(s, d); return { id: r.id, number: r.number }; }); }
export async function submitRequestAction(id: string) { return runAction({ permission: "purchasing.request:edit" }, null, (_d, s) => submitRequest(s, id)); }
export async function cancelRequestAction(id: string) { return runAction({ permission: "purchasing.request:edit" }, null, (_d, s) => cancelRequest(s, id)); }
export async function deleteRequestAction(id: string) { return runAction({ permission: "purchasing.request:delete" }, null, async (_d, s) => { const r = await prisma.purchaseRequest.findFirst({ where: { id, companyId: s.companyId } }); if (!r || r.status !== "DRAFT") throw new Error("NOT_DRAFT"); return prisma.purchaseRequest.delete({ where: { id } }); }); }

export async function saveRfqAction(input: unknown) { const e = Boolean((input as { id?: string })?.id); return runAction({ permission: `purchasing.rfq:${e ? "edit" : "create"}`, schema: rfqSchema }, input, (d, s) => saveRfq(s, d)); }
export async function rfqFromRequestAction(input: unknown) { return runAction({ permission: "purchasing.rfq:create", schema: z.object({ requestId: z.string(), vendorIds: z.array(z.string()).min(1) }) }, input, (d, s) => rfqFromRequest(s, d.requestId, d.vendorIds)); }
export async function rfqStatusAction(input: unknown) { return runAction({ permission: "purchasing.rfq:edit", schema: z.object({ id: z.string(), status: z.enum(["SENT", "CANCELLED", "DRAFT"]) }) }, input, (d, s) => setRfqStatus(s, d.id, d.status)); }
export async function saveQuoteAction(input: unknown) { return runAction({ permission: "purchasing.rfq:edit", schema: quoteSchema }, input, (d, s) => saveQuote(s, d)); }
export async function awardRfqAction(input: unknown) { return runAction({ permission: "purchasing.order:create", schema: z.object({ rfqId: z.string(), vendorId: z.string() }) }, input, (d, s) => awardRfq(s, d.rfqId, d.vendorId)); }

export async function savePoAction(input: unknown) { const e = Boolean((input as { id?: string })?.id); return runAction({ permission: `purchasing.order:${e ? "edit" : "create"}`, schema: poSchema }, input, async (d, s) => { const o = await savePurchaseOrder(s, d); return { id: o.id, number: o.number }; }); }
export async function confirmPoAction(input: unknown) { const id = typeof input === "string" ? input : String((input as { id: string }).id); return runAction({ permission: "purchasing.order:edit" }, null, (_d, s) => confirmPurchaseOrder(s, id)); }
export async function markPoSentAction(id: string) { return runAction({ permission: "purchasing.order:edit" }, null, (_d, s) => markPoSent(s, id)); }
export async function cancelPoAction(id: string) { return runAction({ permission: "purchasing.order:edit" }, null, (_d, s) => cancelPurchaseOrder(s, id)); }
export async function convertPoAction(id: string) { return runAction({ permission: "finance.bill:create" }, null, (_d, s) => convertPoToBill(s, id)); }

export async function saveContractAction(input: unknown) { const e = Boolean((input as { id?: string })?.id); return runAction({ permission: `purchasing.contract:${e ? "edit" : "create"}`, schema: contractSchema }, input, (d, s) => contracts.save(s, d)); }
export async function removeContractAction(id: string) { return runAction({ permission: "purchasing.contract:delete" }, null, (_d, s) => contracts.remove(s, id)); }
export async function saveEvaluationAction(input: unknown) { const e = Boolean((input as { id?: string })?.id); return runAction({ permission: `purchasing.evaluation:${e ? "edit" : "create"}`, schema: evaluationSchema }, input, (d, s) => evaluations.save(s, d)); }
export async function removeEvaluationAction(id: string) { return runAction({ permission: "purchasing.evaluation:delete" }, null, (_d, s) => evaluations.remove(s, id)); }
