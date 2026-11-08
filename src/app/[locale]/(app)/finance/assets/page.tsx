import { financePage, type SP } from "@/modules/finance/_shared/page-helpers";
import { financeLookups } from "@/modules/finance/_shared/lookups";
import { listAssets, assetColumns, categories } from "@/modules/finance/assets/service";
import { PageHeader } from "@/components/shell/page-header";
import { plain } from "@/components/data-table/types";
import { enumOptions } from "@/modules/foundation/_shared/lookups";
import { AssetsClient } from "./client";

export default async function AssetsPage({ searchParams }: { searchParams: SP }) {
  const { session, locale, params, t, tf, te, perms } = await financePage("asset", searchParams);
  const [data, cats, lk] = await Promise.all([listAssets(session, params), categories.all(session, { q: "", page: 1, pageSize: 100, sort: "", filters: {} }), financeLookups(session.companyId, locale)]);
  const catOpts = cats.map((c) => ({ value: c.id, label: `${c.code} · ${locale === "ar" ? c.nameAr : c.nameEn}`, meta: { method: c.method, lifeMonths: c.lifeMonths, rate: Number(c.rate) } }));
  return (
    <>
      <PageHeader title={t("assets.title")} />
      <AssetsClient
        data={plain(data)}
        columns={assetColumns(tf, t)}
        categories={plain(cats)}
        categoryOptions={catOpts}
        lookups={lk}
        can={perms}
        filters={[
          { key: "categoryId", label: tf("category"), type: "select", options: catOpts },
          { key: "status", label: tf("status"), type: "select", options: enumOptions(te, "AssetStatus", ["ACTIVE", "FULLY_DEPRECIATED", "DISPOSED"]) },
          { key: "branchId", label: tf("branch"), type: "select", options: lk.branches },
        ]}
      />
    </>
  );
}
