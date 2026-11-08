import { listPage, type SP } from "@/modules/foundation/_shared/page-helpers";
import { lookups } from "@/modules/foundation/_shared/lookups";
import { listPolicies, APPROVAL_DOC_TYPES } from "@/modules/foundation/approval-policies/service";
import { PageHeader } from "@/components/shell/page-header";
import { plain } from "@/components/data-table/types";
import { PoliciesClient } from "./client";

export default async function ApprovalPoliciesPage({ searchParams }: { searchParams: SP }) {
  const { session, locale, t, perms } = await listPage("approval", searchParams);
  const [policies, lk] = await Promise.all([listPolicies(session), lookups(session.companyId, locale)]);
  return (
    <>
      <PageHeader title={t("approvalPolicies.title")} description={t("approvalPolicies.stepsHint")} />
      <PoliciesClient policies={plain(policies)} docTypes={[...APPROVAL_DOC_TYPES]} roles={lk.roles} users={lk.users} can={perms} />
    </>
  );
}
