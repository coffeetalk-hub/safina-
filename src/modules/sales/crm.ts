import { z } from "zod";
import { prisma } from "@/lib/prisma";
import type { AppSession } from "@/core/auth/session";
import { makeCrud, zStr, zOptStr } from "@/modules/foundation/_shared/crud";
import type { ColumnDef } from "@/components/data-table/types";
import { allocateNumber } from "@/core/numbering";
import { notify } from "@/core/notifications";

export const leadSchema = z.object({
  id: z.string().nullable().optional(),
  nameAr: zStr(),
  nameEn: zStr(),
  companyName: zOptStr(200),
  contactPerson: zOptStr(120),
  email: z.string().trim().email().nullable().optional().or(z.literal("")).transform((v) => (v ? v : null)),
  phone: zOptStr(30),
  source: zOptStr(60),
  status: z.enum(["NEW", "CONTACTED", "QUALIFIED", "CONVERTED", "LOST"]).default("NEW"),
  ownerId: zOptStr(40),
  branchId: zOptStr(40),
  notes: zOptStr(2000),
});
export const leads = makeCrud({ model: "lead", resource: "lead", schema: leadSchema, searchFields: ["nameAr", "nameEn", "companyName", "contactPerson", "email", "phone"], sortFields: ["nameEn", "status", "createdAt", "source"], defaultOrder: { createdAt: "desc" } });

export function leadColumns(tf: (k: string) => string, t: (k: string) => string): ColumnDef[] {
  return [
    { key: "name", label: tf("name"), bilingual: "name" },
    { key: "companyName", label: t("companyName") },
    { key: "contactPerson", label: tf("contactPerson") },
    { key: "phone", label: tf("phone") },
    { key: "email", label: tf("email") },
    { key: "source", label: t("source"), sortable: true },
    { key: "status", label: tf("status"), type: "enum", enumName: "LeadStatus", tones: { NEW: "info", CONTACTED: "secondary", QUALIFIED: "warning", CONVERTED: "success", LOST: "destructive" } },
    { key: "createdAt", label: tf("createdAt"), type: "date", sortable: true },
  ];
}

export const stageSchema = z.object({ id: z.string().nullable().optional(), code: zStr(20), nameAr: zStr(60), nameEn: zStr(60), order: z.coerce.number().int().min(0).default(0), probability: z.coerce.number().int().min(0).max(100).default(10), isWon: z.coerce.boolean().default(false), isLost: z.coerce.boolean().default(false), isActive: z.coerce.boolean().default(true) });
export const stages = makeCrud({ model: "pipelineStage", resource: "opportunity", schema: stageSchema, searchFields: ["code", "nameAr", "nameEn"], sortFields: ["order"], defaultOrder: { order: "asc" } });

export const DEFAULT_STAGES = [
  { code: "NEW", nameAr: "جديدة", nameEn: "New", order: 1, probability: 10 },
  { code: "QUALIFIED", nameAr: "مؤهلة", nameEn: "Qualified", order: 2, probability: 30 },
  { code: "PROPOSAL", nameAr: "عرض سعر", nameEn: "Proposal", order: 3, probability: 50 },
  { code: "NEGOTIATION", nameAr: "تفاوض", nameEn: "Negotiation", order: 4, probability: 75 },
  { code: "WON", nameAr: "مكسوبة", nameEn: "Won", order: 5, probability: 100, isWon: true },
  { code: "LOST", nameAr: "خاسرة", nameEn: "Lost", order: 6, probability: 0, isLost: true },
];
export async function ensureStages(companyId: string) {
  for (const s of DEFAULT_STAGES) await prisma.pipelineStage.upsert({ where: { companyId_code: { companyId, code: s.code } }, create: { companyId, ...s }, update: {} });
}

export const opportunitySchema = z.object({
  id: z.string().nullable().optional(),
  titleAr: zStr(200),
  titleEn: zStr(200),
  customerId: zOptStr(40),
  leadId: zOptStr(40),
  stageId: z.string().min(1),
  ownerId: zOptStr(40),
  branchId: zOptStr(40),
  amount: z.coerce.number().min(0).default(0),
  currencyCode: z.string().length(3).default("SAR"),
  expectedClose: z.string().nullable().optional(),
  source: zOptStr(60),
  notes: zOptStr(2000),
  lostReason: zOptStr(500),
});
export type OpportunityInput = z.infer<typeof opportunitySchema>;

const oppInclude = { stage: true, customer: { select: { id: true, code: true, nameAr: true, nameEn: true } }, lead: { select: { id: true, nameAr: true, nameEn: true } } };

export async function pipeline(session: AppSession, ownerId?: string) {
  await ensureStages(session.companyId);
  const [stagesRows, opps, employees] = await Promise.all([
    prisma.pipelineStage.findMany({ where: { companyId: session.companyId, isActive: true }, orderBy: { order: "asc" } }),
    prisma.opportunity.findMany({ where: { companyId: session.companyId, closedAt: null, ownerId: ownerId || undefined }, include: oppInclude, orderBy: [{ position: "asc" }, { createdAt: "desc" }] }),
    prisma.employee.findMany({ where: { companyId: session.companyId, isSalesperson: true }, select: { id: true, firstNameAr: true, lastNameAr: true, firstNameEn: true, lastNameEn: true } }),
  ]);
  return { stages: stagesRows, opportunities: opps, employees };
}

export async function getOpportunity(session: AppSession, id: string) {
  return prisma.opportunity.findFirst({ where: { id, companyId: session.companyId }, include: { ...oppInclude, activities: { orderBy: { createdAt: "desc" } }, quotations: { select: { id: true, number: true, status: true, total: true, quoteDate: true }, orderBy: { createdAt: "desc" } } } });
}

export async function saveOpportunity(session: AppSession, input: OpportunityInput) {
  const { id, ...rest } = input;
  const stage = await prisma.pipelineStage.findFirst({ where: { id: rest.stageId, companyId: session.companyId } });
  if (!stage) throw new Error("NOT_FOUND");
  const data = { ...rest, customerId: rest.customerId || null, leadId: rest.leadId || null, ownerId: rest.ownerId || null, branchId: rest.branchId || null, expectedClose: rest.expectedClose ? new Date(rest.expectedClose) : null, probability: stage.probability, closedAt: stage.isWon || stage.isLost ? new Date() : null };
  if (id) {
    const ex = await prisma.opportunity.findFirst({ where: { id, companyId: session.companyId } });
    if (!ex) throw new Error("NOT_FOUND");
    return prisma.opportunity.update({ where: { id }, data: { ...data, updatedById: session.userId } });
  }
  return prisma.opportunity.create({ data: { ...data, companyId: session.companyId, createdById: session.userId } });
}

export async function moveOpportunity(session: AppSession, id: string, stageId: string, position: number) {
  const [opp, stage] = await Promise.all([prisma.opportunity.findFirst({ where: { id, companyId: session.companyId } }), prisma.pipelineStage.findFirst({ where: { id: stageId, companyId: session.companyId } })]);
  if (!opp || !stage) throw new Error("NOT_FOUND");
  return prisma.opportunity.update({ where: { id }, data: { stageId, position, probability: stage.probability, closedAt: stage.isWon || stage.isLost ? new Date() : null, updatedById: session.userId } });
}

export const activitySchema = z.object({
  id: z.string().nullable().optional(),
  leadId: zOptStr(40),
  opportunityId: zOptStr(40),
  customerId: zOptStr(40),
  type: z.enum(["CALL", "MEETING", "EMAIL", "TASK", "NOTE"]).default("NOTE"),
  subject: zStr(200),
  details: zOptStr(2000),
  dueAt: z.string().nullable().optional(),
  assigneeId: zOptStr(40),
  done: z.coerce.boolean().default(false),
});
export async function saveActivity(session: AppSession, input: z.infer<typeof activitySchema>) {
  const { id, done, ...rest } = input;
  const data = { ...rest, leadId: rest.leadId || null, opportunityId: rest.opportunityId || null, customerId: rest.customerId || null, assigneeId: rest.assigneeId || null, dueAt: rest.dueAt ? new Date(rest.dueAt) : null, doneAt: done ? new Date() : null };
  if (id) {
    const ex = await prisma.activity.findFirst({ where: { id, companyId: session.companyId } });
    if (!ex) throw new Error("NOT_FOUND");
    return prisma.activity.update({ where: { id }, data });
  }
  const a = await prisma.activity.create({ data: { ...data, companyId: session.companyId, createdById: session.userId } });
  if (data.assigneeId && data.assigneeId !== session.userId) await notify(prisma, { companyId: session.companyId, userId: data.assigneeId, type: "ACTIVITY_ASSIGNED", titleAr: `نشاط جديد: ${data.subject}`, titleEn: `New activity: ${data.subject}`, link: data.opportunityId ? `/sales/opportunities/${data.opportunityId}` : "/sales/leads", entityType: "Activity", entityId: a.id });
  return a;
}
export async function toggleActivity(session: AppSession, id: string) {
  const a = await prisma.activity.findFirst({ where: { id, companyId: session.companyId } });
  if (!a) throw new Error("NOT_FOUND");
  return prisma.activity.update({ where: { id }, data: { doneAt: a.doneAt ? null : new Date() } });
}
export async function deleteActivity(session: AppSession, id: string) {
  const a = await prisma.activity.findFirst({ where: { id, companyId: session.companyId } });
  if (!a) throw new Error("NOT_FOUND");
  return prisma.activity.delete({ where: { id } });
}

/** Converts a lead into a customer (if none linked) and an opportunity in the first stage. */
export async function convertLead(session: AppSession, leadId: string) {
  const lead = await prisma.lead.findFirst({ where: { id: leadId, companyId: session.companyId } });
  if (!lead) throw new Error("NOT_FOUND");
  await ensureStages(session.companyId);
  const first = await prisma.pipelineStage.findFirstOrThrow({ where: { companyId: session.companyId, isActive: true }, orderBy: { order: "asc" } });
  return prisma.$transaction(async (tx) => {
    let customerId = lead.convertedCustomerId;
    if (!customerId) {
      const code = await allocateNumber(session.companyId, "CUSTOMER");
      const c = await tx.customer.create({ data: { companyId: session.companyId, code, nameAr: lead.companyName ?? lead.nameAr, nameEn: lead.companyName ?? lead.nameEn, type: lead.companyName ? "COMPANY" : "INDIVIDUAL", email: lead.email, phone: lead.phone, contactPerson: lead.contactPerson ?? lead.nameEn, salespersonId: lead.ownerId, createdById: session.userId } });
      customerId = c.id;
    }
    const opp = await tx.opportunity.create({ data: { companyId: session.companyId, branchId: lead.branchId, titleAr: lead.nameAr, titleEn: lead.nameEn, leadId: lead.id, customerId, stageId: first.id, ownerId: lead.ownerId, probability: first.probability, source: lead.source, createdById: session.userId } });
    await tx.lead.update({ where: { id: lead.id }, data: { status: "CONVERTED", convertedCustomerId: customerId, updatedById: session.userId } });
    return { opportunityId: opp.id, customerId };
  });
}
