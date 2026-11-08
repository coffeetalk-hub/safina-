import { listPage, type SP } from "@/modules/foundation/_shared/page-helpers";
import { getSettings } from "@/modules/foundation/settings/service";
import { PageHeader } from "@/components/shell/page-header";
import { prisma } from "@/lib/prisma";
import { SettingsClient } from "./client";

export default async function SettingsPage({ searchParams }: { searchParams: SP }) {
  const { session, t, perms } = await listPage("settings", searchParams);
  const [settings, company] = await Promise.all([getSettings(session.companyId), prisma.company.findUniqueOrThrow({ where: { id: session.companyId } })]);
  return (
    <>
      <PageHeader title={t("settings.title")} description={company.nameEn} />
      <SettingsClient settings={settings} hasLogo={!!company.logoKey} company={{ nameAr: company.nameAr, nameEn: company.nameEn, crNumber: company.crNumber, vatNumber: company.vatNumber, addressAr: company.addressAr, addressEn: company.addressEn }} canEdit={perms.edit} />
    </>
  );
}
