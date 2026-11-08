import { getTranslations } from "next-intl/server";
import { LoginForm } from "./login-form";
import { Link } from "@/i18n/navigation";

export default async function LoginPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations("auth");
  return (
    <main className="min-h-screen grid lg:grid-cols-2">
      <section className="hidden lg:flex flex-col justify-between bg-primary text-primary-foreground p-10">
        <div className="text-2xl font-bold">⛵ Safina ERP</div>
        <div>
          <h1 className="text-4xl font-bold leading-tight">{t("heroTitle")}</h1>
          <p className="mt-4 text-primary-foreground/80 max-w-md">{t("heroSubtitle")}</p>
        </div>
        <div className="text-sm text-primary-foreground/70">© {new Date().getFullYear()} The Sailors</div>
      </section>
      <section className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-6">
          <div className="lg:hidden text-xl font-bold">⛵ Safina ERP</div>
          <div>
            <h2 className="text-2xl font-semibold">{t("signIn")}</h2>
            <p className="text-sm text-muted-foreground">{t("signInHint")}</p>
          </div>
          <LoginForm />
          <div className="text-center text-sm text-muted-foreground">
            <Link href="/login" locale={locale === "ar" ? "en" : "ar"} className="underline">
              {locale === "ar" ? "English" : "العربية"}
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
