import { z } from "zod";
import { prisma } from "@/lib/prisma";
import type { AppSession } from "@/core/auth/session";
import { orderByFrom, skipTake, type ColumnDef, type ListParams, type PagedResult } from "@/components/data-table/types";
import { nextDocumentNumber } from "@/core/numbering";
import { submitForApproval } from "@/core/approvals/engine";
import { registerApprovalHooks, DOC_LINKS } from "@/modules/foundation/approvals/hooks";
import { D } from "@/lib/money";

export const prLineSchema = z.object({ itemId: z.string().nullable().optional(), descriptionAr: z.string().min(1).max(500), descriptionEn: z.string().min(1).max(500), quantity: z.coerce.number().positive().default(1), unit: z.string().max(10).default("EA"), estimatedPrice: z.coerce.number().min(0).default(0), expenseAccountId: z.string().nullable().optional(), costCenterId: z.string().nullable().optional() });
export const requestSchema = z.object({
  id: z.string().nullable().optional(),
  requestDate: z.string().min(10),
  neededBy: z.string().nullable().optional(),
  requesterId: z.string().nullable().optional(),
  costCenterId: z.string().nullable().optional(),
  branchId: z.string().nullable().optional(),
  purpose: z.string().max(500).nullable().optional(),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).default("NORMAL"),
  notes: z.string().max(2000).nullable().optional(),
  lines: z.array(prLineSchema).min(1),
});
export type RequestInput = z.infer<typeof requestSchema>;

function where(session: AppSession, p: ListParams) {
  const w: Record<string, unknown> = { companyId: session.companyId };
  if (p.q) w.OR = [{ number: { contains: p.q, mode: "insensitive" } }, { purpose: { contains: p.q, mode: "insensitive" } }];
  if (p.filters.status) w.status = p.filters.status;
  if (p.filters.priority) w.priority = p.filters.priority;
  if (p.filters.requesterId) w.requesterId = p.filters.requesterId;
  if (p.filters.from || p.filters.to) w.requestDate = { gte: p.filters.from ? new Date(p.filters.from) : undefined, lte: p.filters.to ? new Date(p.filters.to) : undefined };
  return w;
}
async function withRequester<T extends { requesterId: string | null }>(session: AppSession, rows: T[]) {
  const ids = [...new Set(rows.map((r) => r.requesterId).filter(Boolean))] as string[];
  const emps = await prisma.employee.findMany({ where: { id: { in: ids } }, select: { id: true, firstNameAr: true, lastNameAr: true, firstNameEn: true, lastNameEn: true } });
  return rows.map((r) => { const e = emps.find((x) => x.id === r.requesterId); return { ...r, requesterAr: e ? `${e.firstNameAr} ${e.lastNameAr}` : "", requesterEn: e ? `${e.firstNameEn} ${e.lastNameEn}` : "" }; });
}
export async function listRequests(session: AppSession, p: ListParams): Promise<PagedResult<Record<string, unknown>>> {
  const w = where(session, p);
  const [rows, total] = await Promise.all([prisma.purchaseRequest.findMany({ where: w, orderBy: orderByFrom(p.sort, ["number", "requestDate", "neededBy", "status", "priority", "estimatedTotal"], { requestDate: "desc" }), ...skipTake(p) }), prisma.purchaseRequest.count({ where: w })]);
  return { rows: await withRequester(session, rows), total, page: p.page, pageSize: p.pageSize };
}
export async function allRequests(session: AppSession, p: ListParams) { return withRequester(session, await prisma.purchaseRequest.findMany({ where: where(session, p), orderBy: { requestDate: "desc" }, take: 10_000 })); }
export async function getRequest(session: AppSession, id: string) {
  return prisma.purchaseRequest.findFirst({ where: { id, companyId: session.companyId }, include: { lines: { orderBy: { lineNo: "asc" } }, rfqs: { select: { id: true, number: true, status: true } }, purchaseOrders: { select: { id: true, number: true, status: true, total: true } } } });
}
export async function saveRequest(session: AppSession, input: RequestInput) {
  const estimated = input.lines.reduce((a, l) => a.plus(D(l.quantity).times(l.estimatedPrice)), D(0));
  const data = { requestDate: new Date(input.requestDate), neededBy: input.neededBy ? new Date(input.neededBy) : null, requesterId: input.requesterId || null, costCenterId: input.costCenterId || null, branchId: input.branchId || null, purpose: input.purpose ?? null, priority: input.priority, notes: input.notes ?? null, estimatedTotal: estimated };
  const lines = input.lines.map((l, i) => ({ lineNo: i + 1, itemId: l.itemId || null, descriptionAr: l.descriptionAr, descriptionEn: l.descriptionEn, quantity: l.quantity, unit: l.unit, estimatedPrice: l.estimatedPrice, expenseAccountId: l.expenseAccountId || null, costCenterId: l.costCenterId || null }));
  return prisma.$transaction(async (tx) => {
    if (input.id) {
      const ex = await tx.purchaseRequest.findFirst({ where: { id: input.id, companyId: session.companyId } });
      if (!ex) throw new Error("NOT_FOUND");
      if (ex.status !== "DRAFT" && ex.status !== "REJECTED") throw new Error("NOT_DRAFT");
      await tx.purchaseRequestLine.deleteMany({ where: { requestId: input.id } });
      return tx.purchaseRequest.update({ where: { id: input.id }, data: { ...data, status: "DRAFT", updatedById: session.userId, lines: { create: lines } } });
    }
    const number = await nextDocumentNumber(tx, session.companyId, "PURCHASE_REQUEST", data.requestDate);
    return tx.purchaseRequest.create({ data: { ...data, companyId: session.companyId, number, createdById: session.userId, lines: { create: lines } } });
  });
}
/** Submit: approval policy if any, otherwise auto-approve. */
export async function submitRequest(session: AppSession, id: string) {
  return prisma.$transaction(async (tx) => {
    const r = await tx.purchaseRequest.findFirst({ where: { id, companyId: session.companyId } });
    if (!r) throw new Error("NOT_FOUND");
    if (r.status !== "DRAFT" && r.status !== "REJECTED") throw new Error("NOT_DRAFT");
    const req = await submitForApproval(tx, { companyId: session.companyId, docType: "PURCHASE_REQUEST", docId: r.id, docNumber: r.number, amount: r.estimatedTotal, requestedById: session.userId, link: `/purchasing/requests/${r.id}` });
    await tx.purchaseRequest.update({ where: { id }, data: { status: req ? "PENDING_APPROVAL" : "APPROVED", updatedById: session.userId } });
    return { status: req ? "PENDING_APPROVAL" : "APPROVED" };
  });
}
export async function cancelRequest(session: AppSession, id: string) {
  const r = await prisma.purchaseRequest.findFirst({ where: { id, companyId: session.companyId } });
  if (!r || !["DRAFT", "PENDING_APPROVAL", "APPROVED", "REJECTED"].includes(r.status)) throw new Error("INVALID_TRANSITION");
  await prisma.approvalRequest.updateMany({ where: { docType: "PURCHASE_REQUEST", docId: id, status: "PENDING" }, data: { status: "CANCELLED" } });
  return prisma.purchaseRequest.update({ where: { id }, data: { status: "CANCELLED", updatedById: session.userId } });
}
export function requestColumns(tf: (k: string) => string, t: (k: string) => string): ColumnDef[] {
  return [
    { key: "number", label: tf("number"), sortable: true, type: "link", hrefTemplate: "/purchasing/requests/{id}" },
    { key: "requestDate", label: tf("date"), type: "date", sortable: true },
    { key: "requester", label: t("requester"), bilingual: "requester" },
    { key: "purpose", label: t("purpose") },
    { key: "neededBy", label: t("neededBy"), type: "date", sortable: true },
    { key: "priority", label: t("priority"), type: "enum", enumName: "Priority", tones: { LOW: "secondary", NORMAL: "outline", HIGH: "warning", URGENT: "destructive" } },
    { key: "estimatedTotal", label: t("estimated"), type: "money", align: "end", sortable: true },
    { key: "status", label: tf("status"), type: "enum", enumName: "PrStatus", tones: { DRAFT: "secondary", PENDING_APPROVAL: "warning", APPROVED: "success", REJECTED: "destructive", RFQ: "info", ORDERED: "success", CANCELLED: "destructive" } },
  ];
}
registerApprovalHooks("PURCHASE_REQUEST", {
  onApproved: async (tx, req) => { await tx.purchaseRequest.update({ where: { id: req.docId }, data: { status: "APPROVED" } }); },
  onRejected: async (tx, req) => { await tx.purchaseRequest.update({ where: { id: req.docId }, data: { status: "REJECTED" } }); },
});
DOC_LINKS.PURCHASE_REQUEST = (id) => `/purchasing/requests/${id}`;
