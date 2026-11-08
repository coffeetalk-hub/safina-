"use client";

import { useTranslations } from "next-intl";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Label } from "@/components/ui/label";
import { Combobox } from "@/components/ui/combobox";

export function LedgerAccountPicker({ accounts, value }: { accounts: { value: string; label: string }[]; value: string }) {
  const t = useTranslations("finance");
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  return (
    <div className="space-y-1 min-w-[280px]">
      <Label>{t("account")}</Label>
      <Combobox options={accounts} value={value} onChange={(v) => { const n = new URLSearchParams(sp.toString()); if (v) n.set("f.accountId", v); else n.delete("f.accountId"); router.push(`${pathname}?${n.toString()}`); }} />
    </div>
  );
}
