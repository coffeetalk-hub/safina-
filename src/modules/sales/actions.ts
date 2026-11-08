"use server";

import { z } from "zod";
import { runAction } from "@/core/action";
import { plain } from "@/components/data-table/types";
import { leads, leadSchema, stages, stageSchema, opportunitySchema, saveOpportunity, moveOpportunity, activitySchema, saveActivity, toggleActivity, deleteActivity, convertLead } from "./crm";
import { quotationSchema, saveQuotation, setQuotationStatus, convertQuotationToOrder, orderSchema, saveOrder, confirmOrder, cancelOrder, convertOrderToInvoice } from "./quotations";
import { priceListSchema, savePriceList, deletePriceList, customerPriceSchema, saveCustomerPricing, customerPricing } from "./price-lists";
import { portalUserSchema, savePortalUser, deletePortalUser } from "./portal";
import { prisma } from "@/lib/prisma";

export async function saveLeadAction(input: unknown) { const e = Boolean((input as { id?: string })?.id); return runAction({ permission: `sales.lead:${e ? "edit" : "create"}`, schema: leadSchema }, input, (d, s) => leads.save(s, d)); }
export async function removeLeadAction(id: string) { return runAction({ permission: "sales.lead:delete" }, null, (_d, s) => leads.remove(s, id)); }
export async function convertLeadAction(id: string) { return runAction({ permission: "sales.opportunity:create" }, null, (_d, s) => convertLead(s, id)); }
export async function saveStageAction(input: unknown) { const e = Boolean((input as { id?: string })?.id); return runAction({ permission: `sales.opportunity:${e ? "edit" : "create"}`, schema: stageSchema }, input, (d, s) => stages.save(s, d)); }
export async function removeStageAction(id: string) { return runAction({ permission: "sales.opportunity:delete" }, null, (_d, s) => stages.remove(s, id)); }
export async function saveOpportunityAction(input: unknown) { const e = Boolean((input as { id?: string })?.id); return runAction({ permission: `sales.opportunity:${e ? "edit" : "create"}`, schema: opportunitySchema }, input, async (d, s) => ({ id: (await saveOpportunity(s, d)).id })); }
export async function moveOpportunityAction(input: unknown) { return runAction({ permission: "sales.opportunity:edit", schema: z.object({ id: z.string(), stageId: z.string(), position: z.coerce.number().int().min(0) }) }, input, (d, s) => moveOpportunity(s, d.id, d.stageId, d.position)); }
export async function removeOpportunityAction(id: string) { return runAction({ permission: "sales.opportunity:delete" }, null, async (_d, s) => { const o = await prisma.opportunity.findFirst({ where: { id, companyId: s.companyId } }); if (!o) throw new Error("NOT_FOUND"); return prisma.opportunity.delete({ where: { id } }); }); }
export async function saveActivityAction(input: unknown) { return runAction({ permission: "sales.lead:create", schema: activitySchema }, input, (d, s) => saveActivity(s, d)); }
export async function toggleActivityAction(id: string) { return runAction({ permission: "sales.lead:edit" }, null, (_d, s) => toggleActivity(s, id)); }
export async function deleteActivityAction(id: string) { return runAction({ permission: "sales.lead:delete" }, null, (_d, s) => deleteActivity(s, id)); }

export async function saveQuotationAction(input: unknown) { const e = Boolean((input as { id?: string })?.id); return runAction({ permission: `sales.quotation:${e ? "edit" : "create"}`, schema: quotationSchema }, input, async (d, s) => { const q = await saveQuotation(s, d); return { id: q.id, number: q.number }; }); }
export async function quotationStatusAction(input: unknown) { return runAction({ permission: "sales.quotation:edit", schema: z.object({ id: z.string(), status: z.enum(["DRAFT", "SENT", "ACCEPTED", "REJECTED", "EXPIRED", "CANCELLED"]) }) }, input, (d, s) => setQuotationStatus(s, d.id, d.status)); }
export async function convertQuotationAction(id: string) { return runAction({ permission: "sales.order:create" }, null, (_d, s) => convertQuotationToOrder(s, id)); }
export async function saveOrderAction(input: unknown) { const e = Boolean((input as { id?: string })?.id); return runAction({ permission: `sales.order:${e ? "edit" : "create"}`, schema: orderSchema }, input, async (d, s) => { const o = await saveOrder(s, d); return { id: o.id, number: o.number }; }); }
export async function confirmOrderAction(input: unknown) { return runAction({ permission: "sales.order:edit", schema: z.object({ id: z.string(), overrideCredit: z.boolean().optional() }) }, input, (d, s) => { if (d.overrideCredit && !s.permissions.has("*") && !s.permissions.has("sales.order:approve")) throw new Error("FORBIDDEN"); return confirmOrder(s, d.id, d.overrideCredit); }); }
export async function cancelOrderAction(id: string) { return runAction({ permission: "sales.order:edit" }, null, (_d, s) => cancelOrder(s, id)); }
export async function convertOrderAction(id: string) { return runAction({ permission: "finance.invoice:create" }, null, (_d, s) => convertOrderToInvoice(s, id)); }

export async function savePriceListAction(input: unknown) { const e = Boolean((input as { id?: string })?.id); return runAction({ permission: `sales.priceList:${e ? "edit" : "create"}`, schema: priceListSchema }, input, async (d, s) => ({ id: (await savePriceList(s, d)).id })); }
export async function deletePriceListAction(id: string) { return runAction({ permission: "sales.priceList:delete" }, null, (_d, s) => deletePriceList(s, id)); }
export async function saveCustomerPricingAction(input: unknown) { return runAction({ permission: "sales.priceList:edit", schema: customerPriceSchema }, input, (d, s) => saveCustomerPricing(s, d)); }
export async function customerPricingAction(customerId: string) { return runAction({ permission: "sales.priceList:view" }, null, async (_d, s) => plain(await customerPricing(s, customerId))); }
export async function savePortalUserAction(input: unknown) { const e = Boolean((input as { id?: string })?.id); return runAction({ permission: `sales.portal:${e ? "edit" : "create"}`, schema: portalUserSchema }, input, async (d, s) => ({ id: (await savePortalUser(s, d)).id })); }
export async function deletePortalUserAction(id: string) { return runAction({ permission: "sales.portal:delete" }, null, (_d, s) => deletePortalUser(s, id)); }
