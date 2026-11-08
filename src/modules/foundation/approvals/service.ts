import { prisma } from "@/lib/prisma";
import type { AppSession } from "@/core/auth/session";
import { canActOn, decide } from "@/core/approvals/engine";
import { runApprovalHooks } from "./hooks";

/** Requests waiting on the current user (their roles or themselves at the current step). */
export async function myPendingApprovals(session: AppSession) {
  const myRoles = await prisma.userCompanyRole.findMany({ where: { userCompany: { userId: session.userId, companyId: session.companyId } }, select: { roleId: true } });
  const roleIds = myRoles.map((r) => r.roleId);
  const reqs = await prisma.approvalRequest.findMany({
    where: { companyId: session.companyId, status: "PENDING" },
    include: { policy: { include: { steps: { orderBy: { order: "asc" } } } }, actions: { orderBy: { at: "asc" }, include: { user: { select: { nameAr: true, nameEn: true } } } } },
    orderBy: { createdAt: "asc" },
  });
  const requesterIds = [...new Set(reqs.map((r) => r.requestedById))];
  const requesters = await prisma.user.findMany({ where: { id: { in: requesterIds } }, select: { id: true, nameAr: true, nameEn: true } });
  return reqs
    .filter((r) => {
      const step = r.policy?.steps[r.currentStep - 1];
      if (!step) return false;
      return (step.userId && step.userId === session.userId) || (step.roleId && roleIds.includes(step.roleId));
    })
    .map((r) => ({ ...r, requester: requesters.find((u) => u.id === r.requestedById) ?? null, stepName: r.policy?.steps[r.currentStep - 1] }));
}

export async function approvalHistory(session: AppSession, take = 100) {
  return prisma.approvalRequest.findMany({
    where: { companyId: session.companyId, OR: [{ requestedById: session.userId }, { actions: { some: { userId: session.userId } } }] },
    include: { actions: { orderBy: { at: "asc" }, include: { user: { select: { nameAr: true, nameEn: true } } } } },
    orderBy: { updatedAt: "desc" },
    take,
  });
}

export async function decideRequest(session: AppSession, requestId: string, decision: "APPROVED" | "REJECTED", comment?: string) {
  if (!(await canActOn(requestId, session.userId, session.companyId))) throw new Error("NOT_APPROVER");
  const outcome = await decide(requestId, session.userId, decision, comment, runApprovalHooks());
  await prisma.auditLog.create({ data: { companyId: session.companyId, userId: session.userId, entity: "ApprovalRequest", entityId: requestId, action: decision === "APPROVED" ? "APPROVE" : "REJECT", after: { comment: comment ?? null } } });
  return outcome;
}
