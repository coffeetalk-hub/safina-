"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Loader2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { useActionError } from "@/lib/action-errors";
import { setupMyEmployeeAction } from "@/modules/hr/actions";

/** Shown on My HR to administrators and HR whose login has no employee record yet. */
export function SetupMyRecord() {
  const t = useTranslations("hr.self");
  const toast = useToast();
  const errorText = useActionError();
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const run = async () => {
    setBusy(true);
    const res = await setupMyEmployeeAction();
    setBusy(false);
    if (res.ok) {
      toast.success(t("setupDone"));
      router.refresh();
    } else toast.error(errorText(res));
  };
  return (
    <Button onClick={run} disabled={busy}>
      {busy ? <Loader2 className="animate-spin" /> : <UserPlus />} {t("setup")}
    </Button>
  );
}
