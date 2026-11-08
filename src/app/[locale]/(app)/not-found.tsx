import { getTranslations } from "next-intl/server";
import { FileQuestion } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";

/** Rendered inside the app shell, so the header and its sign-out button stay on screen. */
export default async function NotFound() {
  const t = await getTranslations("errors");
  const tn = await getTranslations("nav.items");
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
      <FileQuestion className="size-12 text-muted-foreground" />
      <h1 className="text-2xl font-semibold">404</h1>
      <p className="max-w-md text-muted-foreground">{t("pageNotFound")}</p>
      <Button asChild variant="outline">
        <Link href="/dashboard">{tn("dashboard")}</Link>
      </Button>
    </div>
  );
}
