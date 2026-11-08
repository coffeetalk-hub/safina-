"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { CalendarPlus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { generateMonthAction } from "@/modules/hr/actions";

export function GenerateMonth({ month }: { month: string }) {
  const t = useTranslations("hr"); const te = useTranslations("errors");
  const toast = useToast(); const router = useRouter();
  const [m, setM] = React.useState(month);
  const [busy, setBusy] = React.useState(false);
  const run = async () => {
    const [y, mo] = m.split("-").map(Number);
    setBusy(true);
    const r = await generateMonthAction({ year: y, month: mo });
    setBusy(false);
    if (r.ok) { const d = r.data as { created: number; employees: number }; toast.success(t("attendance.generated", { n: d.created, e: d.employees })); router.push(`?f.month=${m}`); router.refresh(); } else toast.error(te.has(r.error) ? te(r.error) : r.error);
  };
  return (
    <div className="flex items-center gap-1">
      <Input type="month" dir="ltr" value={m} onChange={(e) => setM(e.target.value)} className="h-8 w-40" />
      <Button size="sm" variant="outline" onClick={run} disabled={busy || !m}>{busy ? <Loader2 className="animate-spin" /> : <CalendarPlus />} {t("attendance.generate")}</Button>
    </div>
  );
}
