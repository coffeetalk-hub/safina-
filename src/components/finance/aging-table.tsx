"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Download, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Combobox } from "@/components/ui/combobox";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatMoney } from "@/lib/money";

type Row = { id: string; code: string; nameAr: string; nameEn: string; current: number; d1_30: number; d31_60: number; d61_90: number; d90plus: number; total: number };

export function AgingTable({ rows, asOf, parties, partyId, resource, partyLabel }: { rows: Row[]; asOf: string; parties: { value: string; label: string }[]; partyId: string; resource: string; partyLabel: string }) {
  const t = useTranslations("finance");
  const tf = useTranslations("fields");
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
  const sum = (k: keyof Row) => rows.reduce((a, r) => a + Number(r[k]), 0);
  const cols: (keyof Row)[] = ["current", "d1_30", "d31_60", "d61_90", "d90plus", "total"];
  const q = `f.asOf=${asOf}${partyId ? `&f.partyId=${partyId}` : ""}&locale=${locale}`;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3 no-print">
        <div className="space-y-1"><Label>{t("asOf")}</Label><Input type="date" dir="ltr" value={asOf} onChange={(e) => set("f.asOf", e.target.value)} className="w-44" /></div>
        <div className="space-y-1 min-w-[260px]"><Label>{partyLabel}</Label><Combobox options={parties} value={partyId} onChange={(v) => set("f.partyId", v)} /></div>
        <div className="ms-auto flex gap-2">
          <Button variant="outline" size="sm" asChild><a href={`/api/export/${resource}?${q}`}><Download /> Excel</a></Button>
          <Button variant="outline" size="sm" asChild><a href={`/api/pdf/list/${resource}?${q}`} target="_blank" rel="noreferrer"><Printer /> PDF</a></Button>
        </div>
      </div>
      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{tf("code")}</TableHead>
              <TableHead>{tf("name")}</TableHead>
              {cols.map((c) => <TableHead key={c} className="text-end">{t(`aging.${c}`)}</TableHead>)}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && <TableRow><TableCell colSpan={8} className="h-16 text-center text-muted-foreground">—</TableCell></TableRow>}
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell dir="ltr">{r.code}</TableCell>
                <TableCell>{locale === "ar" ? r.nameAr : r.nameEn}</TableCell>
                {cols.map((c) => <TableCell key={c} className={`text-end tabular-nums ${c === "total" ? "font-semibold" : ""}`} dir="ltr">{Number(r[c]) ? formatMoney(Number(r[c]), locale) : "—"}</TableCell>)}
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell colSpan={2}>{t("total")}</TableCell>
              {cols.map((c) => <TableCell key={c} className="text-end tabular-nums" dir="ltr">{formatMoney(sum(c), locale)}</TableCell>)}
            </TableRow>
          </TableFooter>
        </Table>
      </div>
    </div>
  );
}
