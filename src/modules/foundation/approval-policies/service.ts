import { z } from "zod";
import { prisma } from "@/lib/prisma";
import type { AppSession } from "@/core/auth/session";

export const APPROVAL_DOC_TYPES = ["JOURNAL", "INVOICE", "CREDIT_NOTE", "BILL", "PAYMENT", "QUOTATION", "SALES_ORDER", "PURCHASE_REQUEST", "PURCHASE_ORDER", "LEAVE", "LOAN", "PAYROLL", "PETTY_CASH", "BUDGET"] as const;

export const policySchema = z.object({
  id: z.string().nullable().optional(),
  docType: z.enum(APPROVAL_DOC_TYPES),
  nameAr: z.string().trim().min(1).max(120),
  nameEn: z.string().trim().min(1).max(120),
  minAmount: z.coerce.number().min(0).default(0),
  maxAmount: z.coerce.number().min(0).nullable().optional(),
  isActive: z.coerce.boolean().default(true),
  steps: z
    .array(z.object({ roleId: z.string().nullable().optional(), userId: z.string().nullable().optional(), nameAr: z.string().trim().min(1), nameEn: z.string().trim().min(1) }))
    .min(1)
    .refine((s) => s.every((x) => x.roleId || x.userId), "Each step needs a role or a user"),
});

export async function listPolicies(session: AppSession) {
  return prisma.approvalPolicy.findMany({
    where: { companyId: session.companyId },
    orderBy: [{ docType: "asc" }, { minAmount: "asc" }],
    include: { steps: { orderBy: { order: "asc" }, include: { role: { select: { nameAr: true, nameEn: true } } } } },
  });
}

export async function savePolicy(session: AppSession, input: z.infer<typeof policySchema>) {
  const { id, steps, ...data } = input;
  return prisma.$transaction(async (tx) => {
    let policyId = id ?? null;
    if (policyId) {
      const p = await tx.approvalPolicy.findFirst({ where: { id: policyId, companyId: session.companyId } });
      if (!p) throw new Error("NOT_FOUND");
      await tx.approvalPolicy.update({ where: { id: policyId }, data: { ...data, maxAmount: data.maxAmount ?? null } });
      await tx.approvalPolicyStep.deleteMany({ where: { policyId } });
    } else {
      const p = await tx.approvalPolicy.create({ data: { ...data, maxAmount: data.maxAmount ?? null, companyId: session.companyId } });
      policyId = p.id;
    }
    await tx.approvalPolicyStep.createMany({ data: steps.map((s, i) => ({ policyId: policyId!, order: i + 1, roleId: s.roleId || null, userId: s.userId || null, nameAr: s.nameAr, nameEn: s.nameEn })) });
    return { id: policyId };
  });
}

export async function removePolicy(session: AppSession, id: string) {
  const p = await prisma.approvalPolicy.findFirst({ where: { id, companyId: session.companyId } });
  if (!p) throw new Error("NOT_FOUND");
  return prisma.approvalPolicy.delete({ where: { id } });
}
