import { getLocale, getTranslations } from "next-intl/server";
import { requireSession } from "@/core/auth/session";
import { approvalHistory, myPendingApprovals } from "@/modules/foundation/approvals/service";
import { docLink } from "@/modules/foundation/approvals/hooks";
import { PageHeader } from "@/components/shell/page-header";
import { plain } from "@/components/data-table/types";
import { ApprovalsClient } from "./client";

export default async function ApprovalsPage() {
  const session = await requireSession();
  const [locale, t, pending, history] = await Promise.all([getLocale(), getTranslations("foundation.approvals"), myPendingApprovals(session), approvalHistory(session)]);
  const ar = locale === "ar";
  return (
    <>
      <PageHeader title={t("title")} />
      <ApprovalsClient
        pending={plain(
          pending.map((r) => ({
            id: r.id,
            docType: r.docType,
            docNumber: r.docNumber,
            amount: Number(r.amount),
            currentStep: r.currentStep,
            totalSteps: r.totalSteps,
            stepName: r.stepName ? (ar ? r.stepName.nameAr : r.stepName.nameEn) : "",
            requester: r.requester ? (ar ? r.requester.nameAr : r.requester.nameEn) : "",
            createdAt: r.createdAt,
            link: docLink(r.docType, r.docId),
            actions: r.actions.map((a) => ({ step: a.step, user: ar ? a.user.nameAr : a.user.nameEn, decision: a.decision, comment: a.comment, at: a.at })),
          })),
        )}
        history={plain(history.map((r) => ({ id: r.id, docType: r.docType, docNumber: r.docNumber, amount: Number(r.amount), status: r.status, updatedAt: r.updatedAt, link: docLink(r.docType, r.docId), actions: r.actions.map((a) => ({ step: a.step, user: ar ? a.user.nameAr : a.user.nameEn, decision: a.decision, comment: a.comment, at: a.at })) })))}
      />
    </>
  );
}
