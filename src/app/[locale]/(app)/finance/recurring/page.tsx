import { financePage, type SP } from "@/modules/finance/_shared/page-helpers";
import { financeLookups } from "@/modules/finance/_shared/lookups";
import { listRecurring } from "@/modules/finance/journals/service";
import { PageHeader } from "@/components/shell/page-header";
import { plain } from "@/components/data-table/types";
import { RecurringClient } from "./client";

export default async function RecurringPage({ searchParams }: { searchParams: SP }) {
  const { session, locale, t, perms } = await financePage("recurring", searchParams);
  const [rows, lk] = await Promise.all([listRecurring(session), financeLookups(session.companyId, locale)]);
  return (
    <>
      <PageHeader title={t("recurring.title")} description={t("recurring.hint")} />
      <RecurringClient rows={plain(rows).map((r) => ({ ...r, lines: (r.lines ?? []) as unknown as { accountId: string; costCenterId: string | null; description: string; debit: number; credit: number }[] }))} lookups={lk} can={perms} />
    </>
  );
}
