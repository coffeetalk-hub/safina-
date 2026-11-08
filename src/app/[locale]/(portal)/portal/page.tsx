import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { getPortalSession } from "@/core/auth/session";
import { portalHome } from "@/modules/sales/portal";
import { plain } from "@/components/data-table/types";
import { PortalHome } from "./client";

export default async function PortalPage() {
  const ps = await getPortalSession();
  const locale = await getLocale();
  if (!ps) redirect(`/${locale}/portal/login`);
  const t = await getTranslations("portal");
  const data = await portalHome(ps);
  return <PortalHome data={plain(data)} labels={{ title: t("title") }} />;
}
