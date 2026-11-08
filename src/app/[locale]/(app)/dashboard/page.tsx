import { getLocale, getTranslations } from "next-intl/server";
import { requireSession } from "@/core/auth/session";
import { loadDashboard } from "@/modules/foundation/dashboard/service";
import { PageHeader } from "@/components/shell/page-header";
import { WidgetGrid } from "@/components/dashboard/widget-grid";

export default async function DashboardPage() {
  const session = await requireSession();
  const [locale, t] = await Promise.all([getLocale(), getTranslations("foundation.dashboard")]);
  const widgets = await loadDashboard(session, locale);
  return (
    <>
      <PageHeader title={t("title")} description={t("welcome", { name: locale === "ar" ? session.nameAr : session.nameEn })} />
      {widgets.length === 0 ? <p className="text-muted-foreground">{t("noWidgets")}</p> : <WidgetGrid widgets={widgets} />}
    </>
  );
}
