"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast";
import { changePasswordAction } from "@/modules/foundation/users/actions";

export function ChangePasswordForm() {
  const t = useTranslations("foundation.profile");
  const tc = useTranslations("common");
  const toast = useToast();
  const [cur, setCur] = React.useState("");
  const [next, setNext] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  return (
    <form
      className="space-y-3 max-w-sm"
      onSubmit={async (e) => {
        e.preventDefault();
        setLoading(true);
        const res = await changePasswordAction({ currentPassword: cur, newPassword: next });
        setLoading(false);
        if (res.ok) {
          toast.success(t("passwordChanged"));
          setCur("");
          setNext("");
        } else toast.error(res.error);
      }}
    >
      <div className="space-y-1">
        <Label>{t("currentPassword")}</Label>
        <Input type="password" dir="ltr" value={cur} onChange={(e) => setCur(e.target.value)} autoComplete="current-password" />
      </div>
      <div className="space-y-1">
        <Label>{t("newPassword")}</Label>
        <Input type="password" dir="ltr" value={next} onChange={(e) => setNext(e.target.value)} minLength={8} autoComplete="new-password" />
      </div>
      <Button type="submit" disabled={loading || next.length < 8}>
        {loading && <Loader2 className="animate-spin" />} {tc("save")}
      </Button>
    </form>
  );
}
