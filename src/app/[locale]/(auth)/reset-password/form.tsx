"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/misc";
import { resetPasswordAction } from "@/modules/foundation/password-reset/actions";

export function ResetPasswordForm({ token }: { token: string }) {
  const t = useTranslations("auth");
  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(token ? null : t("resetInvalid"));
  const [done, setDone] = React.useState(false);

  if (done) return <Alert><AlertDescription>{t("resetDone")}</AlertDescription></Alert>;

  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setError(null);
        if (password.length < 8) return setError(t("passwordTooShort"));
        if (password !== confirm) return setError(t("passwordsDoNotMatch"));
        setLoading(true);
        const res = await resetPasswordAction({ token, password });
        setLoading(false);
        if (res.ok) setDone(true);
        else setError(res.error === "INVALID_PASSWORD" ? t("passwordTooShort") : t("resetInvalid"));
      }}
    >
      {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
      <div className="space-y-1">
        <Label htmlFor="password">{t("newPassword")}</Label>
        <Input id="password" type="password" dir="ltr" required minLength={8} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      <div className="space-y-1">
        <Label htmlFor="confirm">{t("confirmPassword")}</Label>
        <Input id="confirm" type="password" dir="ltr" required minLength={8} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
      </div>
      <Button type="submit" className="w-full" disabled={loading || !token}>
        {loading && <Loader2 className="animate-spin" />} {t("setNewPassword")}
      </Button>
    </form>
  );
}
