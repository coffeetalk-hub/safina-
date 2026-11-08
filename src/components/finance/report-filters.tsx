"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Download, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Combobox } from "@/components/ui/combobox";

type Opt = { value: string; label: string };

/** Period / branch / cost-center filter bar shared by all statements. */
export function ReportFilters({ from, to, branchId, costCenterId, branches, costCenters, extra, exportResource, showFrom = true }: { from: string; to: string; branchId: string; costCenterId: string; branches: Opt[]; costCenters: Opt[]; extra?: React.ReactNode; exportResource?: string; showFrom?: boolean }) {
  const tf = useTranslations("fields");
  const t = useTranslations("finance");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const set = (k: string, v: string | null) => {
    const n = new URLSearchParams(sp.toString());
    if (v) n.set(k, v);
    else n.delete(k);
    router.push(`${pathname}?${n.toString()}`);
  };
  const q = new URLSearchParams(sp.toString());
  q.set("locale", locale);
  return (
    <div className="mb-4 flex flex-wrap items-end gap-3 no-print">
      {showFrom && <div className="space-y-1"><Label>{tf("from")}</Label><Input type="date" dir="ltr" value={from} onChange={(e) => set("f.from", e.target.value)} className="w-40" /></div>}
      <div className="space-y-1"><Label>{showFrom ? tf("to") : t("asOf")}</Label><Input type="date" dir="ltr" value={to} onChange={(e) => set("f.to", e.target.value)} className="w-40" /></div>
      <div className="space-y-1 min-w-[180px]"><Label>{tf("branch")}</Label><Combobox options={branches} value={branchId} onChange={(v) => set("f.branchId", v)} /></div>
      <div className="space-y-1 min-w-[180px]"><Label>{tf("costCenter")}</Label><Combobox options={costCenters} value={costCenterId} onChange={(v) => set("f.costCenterId", v)} /></div>
      {extra}
      {exportResource && (
        <div className="ms-auto flex gap-2">
          <Button variant="outline" size="sm" asChild><a href={`/api/export/${exportResource}?${q.toString()}`}><Download /> Excel</a></Button>
          <Button variant="outline" size="sm" asChild><a href={`/api/pdf/list/${exportResource}?${q.toString()}`} target="_blank" rel="noreferrer"><Printer /> PDF</a></Button>
        </div>
      )}
    </div>
  );
}
