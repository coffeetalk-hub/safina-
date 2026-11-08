import { salesPage, type SP } from "@/modules/sales/page-helpers";
import { financeLookups } from "@/modules/finance/_shared/lookups";
import { listPriceLists } from "@/modules/sales/price-lists";
import { PageHeader } from "@/components/shell/page-header";
import { plain } from "@/components/data-table/types";
import { PriceListsClient } from "./client";

export default async function PriceListsPage({ searchParams }: { searchParams: SP }) {
  const { session, locale, t, perms } = await salesPage("priceList", searchParams);
  const [lists, lk] = await Promise.all([listPriceLists(session), financeLookups(session.companyId, locale)]);
  return (
    <>
      <PageHeader title={t("priceLists.title")} description={t("priceLists.hint")} />
      <PriceListsClient lists={plain(lists)} lookups={lk} can={perms} />
    </>
  );
}
