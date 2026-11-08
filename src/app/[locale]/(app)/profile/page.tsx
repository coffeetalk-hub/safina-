import { getLocale, getTranslations } from "next-intl/server";
import { requireSession } from "@/core/auth/session";
import { PageHeader } from "@/components/shell/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChangePasswordForm } from "./change-password";

export default async function ProfilePage() {
  const session = await requireSession();
  const [locale, t, tf] = await Promise.all([getLocale(), getTranslations("foundation.profile"), getTranslations("fields")]);
  return (
    <>
      <PageHeader title={t("title")} />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{locale === "ar" ? session.nameAr : session.nameEn}</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-2 text-sm">
            <div className="text-muted-foreground">{tf("email")}</div><div dir="ltr">{session.email}</div>
            <div className="text-muted-foreground">{tf("locale")}</div><div>{session.locale}</div>
            <div className="text-muted-foreground">{tf("companies")}</div><div>{session.companyIds.length}</div>
            <div className="text-muted-foreground">{tf("permissions")}</div><div>{session.permissions.has("*") ? "*" : session.permissions.size}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t("changePassword")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ChangePasswordForm />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
