import { Prisma } from "@prisma/client";
import { prisma, type Tx } from "@/lib/prisma";
import { notify } from "@/core/notifications";
import { D } from "@/lib/money";

/**
 * Generic multi-level approval engine keyed by (docType, amount).
 * Returns the created request, or null when no policy applies (auto-approve).
 */
export async function submitForApproval(
  tx: Tx,
  input: { companyId: string; docType: string; docId: string; docNumber?: string; amount: Prisma.Decimal.Value; requestedById: string; link?: string },
) {
  const amount = D(input.amount);
  const policies = await tx.approvalPolicy.findMany({
    where: { companyId: input.companyId, docType: input.docType, isActive: true, deletedAt: null },
    include: { steps: { orderBy: { order: "asc" }, include: { role: true } } },
  });
  const policy = policies.find(
    (p) => amount.gte(p.minAmount) && (p.maxAmount === null || amount.lte(p.maxAmount)) && p.steps.length > 0,
  );
  if (!policy) return null;

  // cancel any pending request for the same document
  await tx.approvalRequest.updateMany({
    where: { companyId: input.companyId, docType: input.docType, docId: input.docId, status: "PENDING" },
    data: { status: "CANCELLED" },
  });

  const req = await tx.approvalRequest.create({
    data: {
      companyId: input.companyId,
      policyId: policy.id,
      docType: input.docType,
      docId: input.docId,
      docNumber: input.docNumber,
      amount,
      currentStep: 1,
      totalSteps: policy.steps.length,
      requestedById: input.requestedById,
    },
  });
  await notifyStepApprovers(tx, req.id, policy.steps[0], input);
  return req;
}

async function notifyStepApprovers(
  tx: Tx,
  requestId: string,
  step: { roleId: string | null; userId: string | null },
  input: { companyId: string; docType: string; docNumber?: string; link?: string },
) {
  let userIds: string[] = [];
  if (step.userId) userIds = [step.userId];
  else if (step.roleId) {
    const ucr = await tx.userCompanyRole.findMany({
      where: { roleId: step.roleId, userCompany: { companyId: input.companyId } },
      select: { userCompany: { select: { userId: true } } },
    });
    userIds = ucr.map((x) => x.userCompany.userId);
  }
  for (const userId of userIds) {
    await notify(tx, {
      companyId: input.companyId,
      userId,
      type: "APPROVAL_REQUESTED",
      titleAr: `طلب اعتماد: ${input.docType} ${input.docNumber ?? ""}`,
      titleEn: `Approval requested: ${input.docType} ${input.docNumber ?? ""}`,
      link: input.link ?? "/approvals",
      entityType: "ApprovalRequest",
      entityId: requestId,
      email: true,
    });
  }
}

/** Returns whether the user may act on the request's current step. */
export async function canActOn(requestId: string, userId: string, companyId: string) {
  const req = await prisma.approvalRequest.findUnique({
    where: { id: requestId },
    include: { policy: { include: { steps: { orderBy: { order: "asc" } } } } },
  });
  if (!req || req.status !== "PENDING" || req.companyId !== companyId) return false;
  const step = req.policy?.steps[req.currentStep - 1];
  if (!step) return false;
  if (step.userId) return step.userId === userId;
  if (step.roleId) {
    const has = await prisma.userCompanyRole.findFirst({
      where: { roleId: step.roleId, userCompany: { userId, companyId } },
    });
    return Boolean(has);
  }
  return false;
}

export type ApprovalOutcome = "APPROVED" | "REJECTED" | "ADVANCED";

/**
 * Records a decision. On final approval, calls `onApproved`; on rejection, `onRejected`.
 */
export async function decide(
  requestId: string,
  userId: string,
  decision: "APPROVED" | "REJECTED",
  comment: string | undefined,
  hooks: { onApproved?: (tx: Tx, req: { docType: string; docId: string }) => Promise<void>; onRejected?: (tx: Tx, req: { docType: string; docId: string }) => Promise<void> } = {},
): Promise<ApprovalOutcome> {
  return prisma.$transaction(async (tx) => {
    const req = await tx.approvalRequest.findUniqueOrThrow({
      where: { id: requestId },
      include: { policy: { include: { steps: { orderBy: { order: "asc" } } } } },
    });
    if (req.status !== "PENDING") throw new Error("REQUEST_NOT_PENDING");
    await tx.approvalAction.create({ data: { requestId, step: req.currentStep, userId, decision, comment } });

    if (decision === "REJECTED") {
      await tx.approvalRequest.update({ where: { id: requestId }, data: { status: "REJECTED" } });
      await hooks.onRejected?.(tx, req);
      await notify(tx, {
        companyId: req.companyId,
        userId: req.requestedById,
        type: "APPROVAL_REJECTED",
        titleAr: `تم رفض ${req.docType} ${req.docNumber ?? ""}`,
        titleEn: `${req.docType} ${req.docNumber ?? ""} was rejected`,
        entityType: req.docType,
        entityId: req.docId,
        email: true,
      });
      return "REJECTED";
    }

    if (req.currentStep >= req.totalSteps) {
      await tx.approvalRequest.update({ where: { id: requestId }, data: { status: "APPROVED" } });
      await hooks.onApproved?.(tx, req);
      await notify(tx, {
        companyId: req.companyId,
        userId: req.requestedById,
        type: "APPROVAL_APPROVED",
        titleAr: `تم اعتماد ${req.docType} ${req.docNumber ?? ""}`,
        titleEn: `${req.docType} ${req.docNumber ?? ""} was approved`,
        entityType: req.docType,
        entityId: req.docId,
        email: true,
      });
      return "APPROVED";
    }

    const next = req.currentStep + 1;
    await tx.approvalRequest.update({ where: { id: requestId }, data: { currentStep: next } });
    const step = req.policy!.steps[next - 1];
    await notifyStepApprovers(tx, requestId, step, { companyId: req.companyId, docType: req.docType, docNumber: req.docNumber ?? undefined });
    return "ADVANCED";
  });
}
