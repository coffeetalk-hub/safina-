import { notFound } from "next/navigation";
import { financePage } from "@/modules/finance/_shared/page-helpers";
import { financeLookups } from "@/modules/finance/_shared/lookups";
import { getAsset, schedule } from "@/modules/finance/assets/service";
import { PageHeader } from "@/components/shell/page-header";
import { plain } from "@/components/data-table/types";
import { AssetDetail } from "./client";
import { listForEntity } from "@/modules/foundation/attachments/service";
import { can } from "@/core/auth/session";

export default async function AssetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { session, locale, t, perms } = await financePage("asset");
  const [asset, lk] = await Promise.all([getAsset(session, id), financeLookups(session.companyId, locale)]);
  if (!asset) notFound();
  const attachments = await listForEntity(session.companyId, "FixedAsset", id);
  return (
    <>
      <PageHeader title={`${asset.number} · ${locale === "ar" ? asset.nameAr : asset.nameEn}`} description={locale === "ar" ? asset.category.nameAr : asset.category.nameEn} />
      <AssetDetail asset={plain(asset)} schedule={schedule(asset)} lookups={lk} can={perms} attachments={plain(attachments)} canAttach={{ upload: can(session, "foundation.attachment:create"), delete: can(session, "foundation.attachment:delete") }} labels={{ title: t("assets.title") }} />
    </>
  );
}
