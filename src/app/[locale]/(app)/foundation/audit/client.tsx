"use client";

import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { DataTable } from "@/components/data-table/data-table";
import type { ColumnDef, FilterDef, PagedResult } from "@/components/data-table/types";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/dates";

type Row = Record<string, unknown>;

export function AuditClient({ data, columns, filters }: { data: PagedResult<Row>; columns: ColumnDef[]; filters: FilterDef[] }) {
  const t = useTranslations("foundation.audit");
  const tf = useTranslations("fields");
  const locale = useLocale();
  const [row, setRow] = React.useState<Row | null>(null);
  const diff = (row?.diff ?? {}) as Record<string, { from: unknown; to: unknown }>;
  const entries = Object.entries(diff);

  return (
    <>
      <DataTable tableKey="audit" columns={columns} data={data} filters={filters} exportResource="audit" onRowClick={setRow} compact />
      <Dialog open={!!row} onOpenChange={(o) => !o && setRow(null)}>
        <DialogContent size="lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Badge variant="outline">{String(row?.action)}</Badge> {String(row?.entity)} <span className="text-xs text-muted-foreground font-mono" dir="ltr">{String(row?.entityId)}</span>
            </DialogTitle>
          </DialogHeader>
          <div className="text-sm text-muted-foreground">
            {locale === "ar" ? String(row?.userNameAr) : String(row?.userNameEn)} · <span dir="ltr">{formatDateTime(row?.at as string, locale)}</span> {row?.ip ? <span dir="ltr">· {String(row.ip)}</span> : null}
          </div>
          {entries.length === 0 ? (
            <p className="text-sm text-muted-foreground">{row?.action === "CREATE" || row?.action === "DELETE" ? JSON.stringify(row?.after ?? row?.before, null, 2).slice(0, 2000) : t("noDiff")}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{tf("field")}</TableHead>
                  <TableHead>{tf("oldValue")}</TableHead>
                  <TableHead>{tf("newValue")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map(([f, v]) => (
                  <TableRow key={f}>
                    <TableCell className="font-mono text-xs" dir="ltr">{f}</TableCell>
                    <TableCell className="text-destructive whitespace-pre-wrap break-all" dir="auto">{fmt(v.from)}</TableCell>
                    <TableCell className="text-emerald-700 whitespace-pre-wrap break-all" dir="auto">{fmt(v.to)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function fmt(v: unknown) {
  if (v === null || v === undefined) return "—";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}
