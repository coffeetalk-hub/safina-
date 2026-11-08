"use client";

import * as React from "react";
import { signIn } from "next-auth/react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/misc";

export function PortalLoginForm() {
  const t = useTranslations("auth");
  const locale = useLocale();
  const router = useRouter();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  return (
    <form className="space-y-4" onSubmit={async (e) => { e.preventDefault(); setLoading(true); setError(null); const res = await signIn("portal", { email, password, redirect: false }); setLoading(false); if (res?.error) return setError(t("invalidCredentials")); router.push(`/${locale}/portal`); router.refresh(); }}>
      {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
      <div className="space-y-1"><Label>{t("email")}</Label><Input type="email" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></div>
      <div className="space-y-1"><Label>{t("password")}</Label><Input type="password" dir="ltr" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" /></div>
      <Button type="submit" className="w-full" disabled={loading}>{loading && <Loader2 className="animate-spin" />} {t("signIn")}</Button>
    </form>
  );
}
