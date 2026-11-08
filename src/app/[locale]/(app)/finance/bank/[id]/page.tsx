import { notFound } from "next/navigation";
import { financePage, type SP } from "@/modules/finance/_shared/page-helpers";
import { reconciliationData } from "@/modules/finance/bank/service";
import { PageHeader } from "@/components/shell/page-header";
import { plain } from "@/components/data-table/types";
import { ReconciliationClient } from "./client";
import { can } from "@/core/auth/session";

export default async function BankReconciliationPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SP }) {
  const { id } = await params;
  const { session, locale, params: p, t } = await financePage("reconciliation", searchParams);
  const asOf = p.filters.asOf || new Date().toISOString().slice(0, 10);
  let data;
  try {
    data = await reconciliationData(session, id, new Date(asOf));
  } catch {
    notFound();
  }
  return (
    <>
      <PageHeader title={`${t("reconciliation.title")} — ${locale === "ar" ? data.bank.nameAr : data.bank.nameEn}`} description={`${data.bank.bankName ?? ""} ${data.bank.iban ?? ""}`} />
      <ReconciliationClient bankAccountId={id} asOf={asOf} data={plain({ statement: data.statement, gl: data.gl, glBalance: data.glBalance, reconciliations: data.reconciliations, currency: data.bank.currencyCode })} can={{ edit: can(session, "finance.reconciliation:edit"), create: can(session, "finance.reconciliation:create"), approve: can(session, "finance.reconciliation:approve"), delete: can(session, "finance.reconciliation:delete") }} />
    </>
  );
}
