import { listPage, type SP } from "@/modules/foundation/_shared/page-helpers";
import { listCurrencies, listRates } from "@/modules/foundation/currencies/service";
import { PageHeader } from "@/components/shell/page-header";
import { CurrenciesClient } from "./client";
import { plain } from "@/components/data-table/types";

export default async function CurrenciesPage({ searchParams }: { searchParams: SP }) {
  const { session, t, perms } = await listPage("currency", searchParams);
  const [currencies, rates] = await Promise.all([listCurrencies(session), listRates(session)]);
  return (
    <>
      <PageHeader title={t("currencies.title")} />
      <CurrenciesClient currencies={plain(currencies)} rates={plain(rates)} can={perms} />
    </>
  );
}
