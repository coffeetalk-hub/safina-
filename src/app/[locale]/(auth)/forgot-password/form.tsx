"use client";

import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/misc";
import { requestPasswordResetAction } from "@/modules/foundation/password-reset/actions";

export function ForgotPasswordForm({ realm }: { realm: "STAFF" | "PORTAL" }) {
  const t = useTranslations("auth");
  const locale = useLocale();
  const [email, setEmail] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [sent, setSent] = React.useState(false);

  if (sent) return <Alert><AlertDescription>{t("resetSent")}</AlertDescription></Alert>;

  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setLoading(true);
        await requestPasswordResetAction({ email, realm, locale });
        setLoading(false);
        setSent(true);
      }}
    >
      <div className="space-y-1">
        <Label htmlFor="email">{t("email")}</Label>
        <Input id="email" type="email" dir="ltr" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading && <Loader2 className="animate-spin" />} {t("sendResetLink")}
      </Button>
    </form>
  );
}
