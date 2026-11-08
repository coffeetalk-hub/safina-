import { financePage, type SP } from "@/modules/finance/_shared/page-helpers";
import { financeLookups } from "@/modules/finance/_shared/lookups";
import { fundsWithBalances, listVouchers, voucherColumns } from "@/modules/finance/petty-cash/service";
import { PageHeader } from "@/components/shell/page-header";
import { plain } from "@/components/data-table/types";
import { PettyCashClient } from "./client";
import { enumOptions } from "@/modules/foundation/_shared/lookups";

export default async function PettyCashPage({ searchParams }: { searchParams: SP }) {
  const { session, locale, params, t, tf, te, perms } = await financePage("pettyCash", searchParams);
  const [funds, vouchers, lk] = await Promise.all([fundsWithBalances(session), listVouchers(session, params), financeLookups(session.companyId, locale)]);
  return (
    <>
      <PageHeader title={t("pettyCash.title")} />
      <PettyCashClient
        funds={plain(funds)}
        vouchers={plain(vouchers)}
        columns={voucherColumns(tf, t)}
        lookups={lk}
        can={perms}
        filters={[
          { key: "fundId", label: t("fund"), type: "select", options: funds.map((f) => ({ value: f.id, label: `${f.code} · ${locale === "ar" ? f.nameAr : f.nameEn}` })) },
          { key: "type", label: tf("type"), type: "select", options: enumOptions(te, "PettyCashType", ["EXPENSE", "REPLENISHMENT"]) },
          { key: "status", label: tf("status"), type: "select", options: enumOptions(te, "DocStatus", ["DRAFT", "POSTED", "REVERSED"]) },
          { key: "from", label: tf("from"), type: "date" },
          { key: "to", label: tf("to"), type: "date" },
        ]}
      />
    </>
  );
}
