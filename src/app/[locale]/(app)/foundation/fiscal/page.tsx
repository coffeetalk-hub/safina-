import { listPage, type SP } from "@/modules/foundation/_shared/page-helpers";
import { listFiscalYears } from "@/modules/foundation/fiscal/service";
import { PageHeader } from "@/components/shell/page-header";
import { FiscalClient } from "./client";
import { plain } from "@/components/data-table/types";

export default async function FiscalPage({ searchParams }: { searchParams: SP }) {
  const { session, t, perms } = await listPage("fiscal", searchParams);
  const years = await listFiscalYears(session);
  return (
    <>
      <PageHeader title={t("fiscal.title")} description={t("fiscal.generateMonthly")} />
      <FiscalClient years={plain(years)} can={perms} />
    </>
  );
}
