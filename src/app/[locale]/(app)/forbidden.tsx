import { getTranslations } from "next-intl/server";
import { ShieldAlert } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";

export default async function Forbidden() {
  const t = await getTranslations("errors");
  const tn = await getTranslations("nav.items");
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
      <ShieldAlert className="size-12 text-destructive" />
      <h1 className="text-2xl font-semibold">403</h1>
      <p className="max-w-md text-muted-foreground">{t("FORBIDDEN")}</p>
      <Button asChild variant="outline">
        <Link href="/dashboard">{tn("dashboard")}</Link>
      </Button>
    </div>
  );
}
