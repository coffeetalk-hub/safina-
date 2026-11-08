import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { PortalLoginForm } from "./form";

export default async function PortalLoginPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations("portal");
  const tAuth = await getTranslations("auth");
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6 rounded-xl border bg-background p-8 shadow-sm">
        <div><div className="text-xl font-bold">⛵ Safina ERP</div><h1 className="mt-2 text-lg font-semibold">{t("title")}</h1><p className="text-sm text-muted-foreground">{t("loginHint")}</p></div>
        <PortalLoginForm />
        <div className="flex items-center justify-between text-sm">
          <Link href="/forgot-password?realm=portal" className="text-primary underline">{tAuth("forgotPassword")}</Link>
          <Link href="/login" className="text-muted-foreground underline">{tAuth("staffSignIn")}</Link>
        </div>
        <div className="text-center text-sm text-muted-foreground"><Link href="/portal/login" locale={locale === "ar" ? "en" : "ar"} className="underline">{locale === "ar" ? "English" : "العربية"}</Link></div>
      </div>
    </main>
  );
}
