import { financePage, type SP } from "@/modules/finance/_shared/page-helpers";
import { computeVatReturn, listVatReturns } from "@/modules/finance/vat/service";
import { PageHeader } from "@/components/shell/page-header";
import { plain } from "@/components/data-table/types";
import { VatClient } from "./client";

export default async function VatPage({ searchParams }: { searchParams: SP }) {
  const { session, params, t, perms } = await financePage("vat", searchParams);
  const now = new Date();
  const q = Math.floor(now.getUTCMonth() / 3);
  const from = params.filters.from || new Date(Date.UTC(now.getUTCFullYear(), q * 3, 1)).toISOString().slice(0, 10);
  const to = params.filters.to || new Date(Date.UTC(now.getUTCFullYear(), q * 3 + 3, 0)).toISOString().slice(0, 10);
  const [report, returns] = await Promise.all([computeVatReturn(session, new Date(from), new Date(to)), listVatReturns(session)]);
  return (
    <>
      <PageHeader title={t("vatReturn.title")} description={t("vatReturn.hint")} />
      <VatClient from={from} to={to} report={plain(report)} returns={plain(returns)} can={perms} />
    </>
  );
}
