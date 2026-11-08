"use client";

import { useTranslations } from "next-intl";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations("errors");
  const tc = useTranslations("common");
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
      <AlertTriangle className="size-12 text-amber-500" />
      <h1 className="text-xl font-semibold">{t("UNKNOWN")}</h1>
      {error.digest && (
        <p className="text-xs text-muted-foreground" dir="ltr">
          ref: {error.digest}
        </p>
      )}
      <Button variant="outline" onClick={reset}>
        {tc("back")}
      </Button>
    </div>
  );
}
