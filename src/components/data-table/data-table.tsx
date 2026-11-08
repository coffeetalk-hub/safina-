"use client";

import * as React from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Columns3, Download, Printer, Search, X } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDate, formatDateTime } from "@/lib/dates";
import { formatMoney, formatNumber } from "@/lib/money";
import { cellValue, fillTemplate, getPath, type ColumnDef, type FilterDef, type PagedResult } from "./types";
import { cn } from "@/lib/utils";
import { Link } from "@/i18n/navigation";

type Row = Record<string, unknown>;

type Props = {
  tableKey: string;
  columns: ColumnDef[];
  data: PagedResult<Row>;
  filters?: FilterDef[];
  exportResource?: string;
  /** Extra query params appended to export / print URLs (e.g. a parent id) */
  exportParams?: Record<string, string>;
  onRowClick?: (row: Row) => void;
  rowHrefTemplate?: string;
  toolbar?: React.ReactNode;
  emptyMessage?: string;
  /** Client-only cell override (only usable from client components) */
  renderCell?: (key: string, row: Row) => React.ReactNode | undefined;
  compact?: boolean;
};

export function useCellFormatter() {
  const t = useTranslations("table");
  const te = useTranslations("enums");
  const locale = useLocale();
  return React.useCallback(
    (col: ColumnDef, row: Row): React.ReactNode => {
      const v = cellValue(col, row, locale);
      if (v === null || v === undefined || v === "") return <span className="text-muted-foreground">—</span>;
      switch (col.type) {
        case "money": {
          const cur = col.currencyPath ? (getPath(row, col.currencyPath) as string) : "SAR";
          return <span dir="ltr" className="tabular-nums">{formatMoney(v as number, locale, cur || "SAR")}</span>;
        }
        case "number":
          return <span dir="ltr" className="tabular-nums">{formatNumber(v as number, locale)}</span>;
        case "date":
          return <span dir="ltr">{formatDate(v as string, locale)}</span>;
        case "datetime":
          return <span dir="ltr">{formatDateTime(v as string, locale)}</span>;
        case "boolean":
          return <Badge variant={v ? "success" : "secondary"}>{v ? t("yes") : t("no")}</Badge>;
        case "badge":
          return <Badge variant={col.tones?.[String(v)] ?? "outline"}>{String(v)}</Badge>;
        case "enum": {
          const key = `${col.enumName}.${String(v)}`;
          return <Badge variant={col.tones?.[String(v)] ?? "outline"}>{te.has(key) ? te(key) : String(v)}</Badge>;
        }
        case "link":
          return (
            <Link href={fillTemplate(col.hrefTemplate ?? "#", row)} className="text-primary underline-offset-2 hover:underline" onClick={(e) => e.stopPropagation()}>
              {String(v)}
            </Link>
          );
        default:
          return String(v);
      }
    },
    [locale, t, te],
  );
}

export function DataTable({ tableKey, columns, data, filters = [], exportResource, exportParams, onRowClick, rowHrefTemplate, toolbar, emptyMessage, renderCell, compact }: Props) {
  const t = useTranslations("table");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const format = useCellFormatter();

  const storageKey = `safina.table.${tableKey}`;
  const defaultVisibility = React.useMemo(() => Object.fromEntries(columns.map((c) => [c.key, !c.hidden])), [columns]);
  // Column visibility: defaults from column defs, overridden by a per-user localStorage preference.
  const [visibility, setVisibility] = React.useState<Record<string, boolean>>(defaultVisibility);
  const hydratedKey = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (hydratedKey.current === storageKey) return;
    hydratedKey.current = storageKey;
    let stored: Record<string, boolean> | null = null;
    try {
      const raw = window.localStorage.getItem(storageKey);
      stored = raw ? (JSON.parse(raw) as Record<string, boolean>) : null;
    } catch {
      stored = null;
    }
    if (stored) {
      const next = { ...defaultVisibility, ...stored };
      // defer to avoid a synchronous setState inside the effect body
      const id = window.setTimeout(() => setVisibility(next), 0);
      return () => window.clearTimeout(id);
    }
  }, [storageKey, defaultVisibility]);
  const toggle = (key: string, v: boolean) => {
    setVisibility((prev) => {
      const next = { ...prev, [key]: v };
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  const [q, setQ] = React.useState(sp.get("q") ?? "");
  const sort = sp.get("sort") ?? "";

  const setParams = React.useCallback(
    (patch: Record<string, string | null>) => {
      const next = new URLSearchParams(sp.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v === null || v === "") next.delete(k);
        else next.set(k, v);
      }
      if (!("page" in patch)) next.delete("page");
      router.push(`${pathname}?${next.toString()}`);
    },
    [sp, router, pathname],
  );

  React.useEffect(() => {
    const h = setTimeout(() => {
      if ((sp.get("q") ?? "") !== q) setParams({ q });
    }, 350);
    return () => clearTimeout(h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const visibleCols = columns.filter((c) => visibility[c.key] !== false);
  const pageCount = Math.max(1, Math.ceil(data.total / data.pageSize));
  const activeFilters = filters.filter((f) => sp.get(`f.${f.key}`));

  const [exportHref, printHref] = React.useMemo(() => {
    if (!exportResource) return [null, null];
    const next = new URLSearchParams(sp.toString());
    next.delete("page");
    next.delete("pageSize");
    for (const [k, v] of Object.entries(exportParams ?? {})) next.set(k, v);
    next.set("cols", visibleCols.map((c) => c.key).join(","));
    next.set("locale", locale);
    return [`/api/export/${exportResource}?${next.toString()}`, `/api/pdf/list/${exportResource}?${next.toString()}`];
  }, [exportResource, exportParams, sp, visibleCols, locale]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 no-print">
        <div className="relative flex-1 min-w-[180px] max-w-sm">
          <Search className="absolute start-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("search")} className="ps-8" />
          {q && (
            <button className="absolute end-2 top-2.5 text-muted-foreground cursor-pointer" onClick={() => setQ("")} aria-label="clear">
              <X className="size-4" />
            </button>
          )}
        </div>
        {filters.map((f) => (
          <FilterControl key={f.key} def={f} value={sp.get(`f.${f.key}`) ?? ""} onChange={(v) => setParams({ [`f.${f.key}`]: v })} />
        ))}
        {activeFilters.length > 0 && (
          <Button variant="ghost" size="sm" onClick={() => setParams(Object.fromEntries(filters.map((f) => [`f.${f.key}`, null])))}>
            <X /> {t("clearFilters")}
          </Button>
        )}
        <div className="ms-auto flex items-center gap-2">
          {toolbar}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Columns3 /> <span className="hidden sm:inline">{t("columns")}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>{t("toggleColumns")}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {columns.map((col) => (
                <DropdownMenuCheckboxItem key={col.key} checked={visibility[col.key] !== false} onCheckedChange={(v) => toggle(col.key, !!v)}>
                  {col.label}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          {exportHref && (
            <Button variant="outline" size="sm" asChild>
              <a href={exportHref} target="_blank" rel="noreferrer">
                <Download /> <span className="hidden sm:inline">{t("exportExcel")}</span>
              </a>
            </Button>
          )}
          {printHref && (
            <Button variant="outline" size="sm" asChild>
              <a href={printHref} target="_blank" rel="noreferrer">
                <Printer /> <span className="hidden sm:inline">{t("print")}</span>
              </a>
            </Button>
          )}
        </div>
      </div>

      <div className="rounded-md border bg-card">
        <Table className={cn(compact && "text-xs")}>
          <TableHeader>
            <TableRow>
              {visibleCols.map((col) => {
                const isSorted = sort === col.key ? "asc" : sort === `-${col.key}` ? "desc" : null;
                return (
                  <TableHead key={col.key} className={cn(col.align === "end" && "text-end", col.align === "center" && "text-center")}>
                    {col.sortable ? (
                      <button className="inline-flex items-center gap-1 hover:text-primary cursor-pointer" onClick={() => setParams({ sort: isSorted === "asc" ? `-${col.key}` : isSorted === "desc" ? "" : col.key })}>
                        {col.label}
                        {isSorted === "asc" ? <ArrowUp className="size-3.5" /> : isSorted === "desc" ? <ArrowDown className="size-3.5" /> : <ArrowUpDown className="size-3.5 opacity-40" />}
                      </button>
                    ) : (
                      col.label
                    )}
                  </TableHead>
                );
              })}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={visibleCols.length} className="h-24 text-center text-muted-foreground">
                  {emptyMessage ?? t("noResults")}
                </TableCell>
              </TableRow>
            ) : (
              data.rows.map((row) => (
                <TableRow
                  key={String(row.id)}
                  className={cn((onRowClick || rowHrefTemplate) && "cursor-pointer")}
                  onClick={() => {
                    if (rowHrefTemplate) router.push(`/${locale}${fillTemplate(rowHrefTemplate, row)}`);
                    else onRowClick?.(row);
                  }}
                >
                  {visibleCols.map((col) => (
                    <TableCell key={col.key} className={cn(col.align === "end" && "text-end", col.align === "center" && "text-center")}>
                      {renderCell?.(col.key, row) ?? format(col, row)}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground no-print">
        <div>{t("showing", { from: data.total === 0 ? 0 : (data.page - 1) * data.pageSize + 1, to: Math.min(data.page * data.pageSize, data.total), total: data.total })}</div>
        <div className="flex items-center gap-2">
          <Select value={String(data.pageSize)} onValueChange={(v) => setParams({ pageSize: v })}>
            <SelectTrigger size="sm" className="w-[90px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[10, 20, 50, 100].map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon-sm" disabled={data.page <= 1} onClick={() => setParams({ page: String(data.page - 1) })}>
            <ChevronLeft className="rtl:rotate-180" />
          </Button>
          <span dir="ltr" className="tabular-nums">
            {data.page} / {pageCount}
          </span>
          <Button variant="outline" size="icon-sm" disabled={data.page >= pageCount} onClick={() => setParams({ page: String(data.page + 1) })}>
            <ChevronRight className="rtl:rotate-180" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function FilterControl({ def, value, onChange }: { def: FilterDef; value: string; onChange: (v: string | null) => void }) {
  const t = useTranslations("table");
  if (def.type === "select" || def.type === "boolean") {
    const opts = def.type === "boolean" ? [{ value: "true", label: t("yes") }, { value: "false", label: t("no") }] : def.options ?? [];
    return (
      <Select value={value || "__all"} onValueChange={(v) => onChange(v === "__all" ? null : v)}>
        <SelectTrigger size="sm" className="w-auto min-w-[140px]">
          <SelectValue placeholder={def.label} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all">
            {def.label}: {t("all")}
          </SelectItem>
          {opts.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }
  if (def.type === "date") {
    return <Input type="date" className="h-8 w-auto" value={value} onChange={(e) => onChange(e.target.value || null)} title={def.label} />;
  }
  return <Input className="h-8 w-auto" placeholder={def.label} value={value} onChange={(e) => onChange(e.target.value || null)} />;
}
