import { getLocale, getTranslations } from "next-intl/server";
import { requireSession } from "@/core/auth/session";
import { listNotifications } from "@/modules/foundation/notifications/service";
import { PageHeader } from "@/components/shell/page-header";
import { NotificationsClient } from "./client";

export default async function NotificationsPage() {
  const session = await requireSession();
  const [locale, t, items] = await Promise.all([getLocale(), getTranslations("foundation.notifications"), listNotifications(session)]);
  return (
    <>
      <PageHeader title={t("title")} />
      <NotificationsClient items={items.map((n) => ({ id: n.id, title: locale === "ar" ? n.titleAr : n.titleEn, body: locale === "ar" ? n.bodyAr : n.bodyEn, link: n.link, isRead: n.isRead, createdAt: n.createdAt.toISOString(), type: n.type }))} />
    </>
  );
}
