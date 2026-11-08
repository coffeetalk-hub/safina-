import { hrPage, type SP } from "@/modules/hr/page-helpers";
import { financeLookups } from "@/modules/finance/_shared/lookups";
import { ensureHrDefaults, getHrSettings, gosiRates, gosiRateColumns, payComponents, payComponentColumns, holidays, holidayColumns } from "@/modules/hr/settings";
import { PageHeader } from "@/components/shell/page-header";
import { plain } from "@/components/data-table/types";
import { HrSettingsClient } from "./client";

export default async function HrSettingsPage({ searchParams }: { searchParams: SP }) {
  const { session, locale, params, t, tf, perms } = await hrPage("payroll", searchParams);
  await ensureHrDefaults(session.companyId);
  const [settings, rates, comps, hols, lk] = await Promise.all([getHrSettings(session.companyId), gosiRates.list(session, params), payComponents.list(session, params), holidays.list(session, params), financeLookups(session.companyId, locale)]);
  const sp = await searchParams;
  return (
    <>
      <PageHeader title={t("settings.title")} description={t("settings.hint")} />
      <HrSettingsClient tab={typeof sp.tab === "string" ? sp.tab : "rules"} settings={plain(settings)} rates={plain(rates)} comps={plain(comps)} hols={plain(hols)} columns={{ rates: gosiRateColumns(tf, t), comps: payComponentColumns(tf, t), hols: holidayColumns(tf) }} accounts={lk.accounts.filter((a) => a.meta?.type === "LIABILITY" || a.meta?.type === "EXPENSE" || a.meta?.type === "ASSET")} can={{ create: perms.edit, edit: perms.edit, delete: perms.delete }} />
    </>
  );
}
