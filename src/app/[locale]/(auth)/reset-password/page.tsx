import { getTranslations } from "next-intl/server";
import { LogIn } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { ResetPasswordForm } from "./form";

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  const t = await getTranslations("auth");
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6 rounded-xl border bg-background p-8 shadow-sm">
        <div>
          <div className="text-xl font-bold">⛵ Safina ERP</div>
          <h1 className="mt-2 text-lg font-semibold">{t("resetTitle")}</h1>
        </div>
        <ResetPasswordForm token={token ?? ""} />
        <Button variant="outline" className="w-full" asChild>
          <Link href="/login"><LogIn className="rtl:rotate-180" /> {t("signIn")}</Link>
        </Button>
      </div>
    </main>
  );
}
