import { getTranslations } from "next-intl/server";
import { LogIn } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { ForgotPasswordForm } from "./form";

export default async function ForgotPasswordPage({ searchParams }: { searchParams: Promise<{ realm?: string }> }) {
  const { realm } = await searchParams;
  const portal = realm === "portal";
  const t = await getTranslations("auth");
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6 rounded-xl border bg-background p-8 shadow-sm">
        <div>
          <div className="text-xl font-bold">⛵ Safina ERP</div>
          <h1 className="mt-2 text-lg font-semibold">{t("forgotTitle")}</h1>
          <p className="text-sm text-muted-foreground">{t("forgotHint")}</p>
        </div>
        <ForgotPasswordForm realm={portal ? "PORTAL" : "STAFF"} />
        <Button variant="outline" className="w-full" asChild>
          <Link href={portal ? "/portal/login" : "/login"}><LogIn className="rtl:rotate-180" /> {t("signIn")}</Link>
        </Button>
      </div>
    </main>
  );
}
