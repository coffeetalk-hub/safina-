import { z } from "zod";

/** URL search-param contract shared by every list view. */
export const listParamsSchema = z.object({
  q: z.string().optional().default(""),
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(5).max(200).optional().default(20),
  sort: z.string().optional().default(""), // "field" or "-field"
});
export type ListParams = z.infer<typeof listParamsSchema> & { filters: Record<string, string> };

export function parseListParams(sp: Record<string, string | string[] | undefined>): ListParams {
  const flat: Record<string, string> = {};
  const filters: Record<string, string> = {};
  for (const [k, v] of Object.entries(sp)) {
    const val = Array.isArray(v) ? v[0] : v;
    if (val === undefined) continue;
    if (k.startsWith("f.")) filters[k.slice(2)] = val;
    else flat[k] = val;
  }
  const parsed = listParamsSchema.safeParse(flat);
  const base = parsed.success ? parsed.data : listParamsSchema.parse({});
  return { ...base, filters };
}

export type PagedResult<T> = { rows: T[]; total: number; page: number; pageSize: number };

export function orderByFrom(sort: string, allowed: string[], fallback: Record<string, "asc" | "desc">) {
  if (!sort) return fallback;
  const desc = sort.startsWith("-");
  const field = desc ? sort.slice(1) : sort;
  if (!allowed.includes(field)) return fallback;
  return { [field]: desc ? "desc" : "asc" } as Record<string, "asc" | "desc">;
}

export function skipTake(p: ListParams) {
  return { skip: (p.page - 1) * p.pageSize, take: p.pageSize };
}

/**
 * Serialisable column definition shared by the client table and the Excel exporter.
 * No functions — pages are server components passing props to a client table.
 */
export type ColumnDef = {
  key: string;
  label: string;
  sortable?: boolean;
  align?: "start" | "end" | "center";
  type?: "text" | "number" | "money" | "date" | "datetime" | "boolean" | "badge" | "enum" | "link";
  /** Dotted path into the row (defaults to key) */
  path?: string;
  /** For bilingual fields: prefix such as "name" → nameAr / nameEn chosen by locale */
  bilingual?: string;
  /** For type "enum": the enum namespace in messages.enums */
  enumName?: string;
  /** For type "link": href template with {id} / {field} tokens */
  hrefTemplate?: string;
  hidden?: boolean;
  /** Tone map for badge/enum values → variant */
  tones?: Record<string, "default" | "secondary" | "destructive" | "outline" | "success" | "warning" | "info">;
  /** currency code path (money columns), defaults to SAR */
  currencyPath?: string;
};

export type FilterDef = {
  key: string;
  label: string;
  type: "select" | "text" | "date" | "boolean";
  options?: { value: string; label: string }[];
};

export function getPath(row: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, k) => (acc && typeof acc === "object" ? (acc as Record<string, unknown>)[k] : undefined), row);
}

export function cellValue(col: ColumnDef, row: unknown, locale: string): unknown {
  if (col.bilingual) {
    const base = col.bilingual.includes(".") ? col.bilingual.slice(0, col.bilingual.lastIndexOf(".") + 1) : "";
    const field = col.bilingual.slice(base.length);
    return getPath(row, `${base}${field}${locale === "ar" ? "Ar" : "En"}`);
  }
  return getPath(row, col.path ?? col.key);
}

export function fillTemplate(tpl: string, row: Record<string, unknown>) {
  return tpl.replace(/\{(\w+)\}/g, (_m, k) => String(row[k] ?? ""));
}

/** Type-level mirror of plain(): Decimal → number, Date → string, recursively. */
export type Plain<T> = T extends { toNumber(): number; toFixed(dp?: number): string }
  ? number
  : T extends Date
    ? string
    : T extends (infer U)[]
      ? Plain<U>[]
      : T extends object
        ? { [K in keyof T]: Plain<T[K]> }
        : T;

/** Recursively converts Prisma Decimal/BigInt to numbers and Dates to ISO strings so rows can cross the RSC boundary. */
export function plain<T>(value: T): Plain<T> {
  const walk = (v: unknown): unknown => {
    if (v === null || v === undefined) return v;
    if (typeof v === "bigint") return Number(v);
    if (typeof v !== "object") return v;
    if (v instanceof Date) return v.toISOString();
    const d = v as { toNumber?: unknown; toFixed?: unknown; toString(): string };
    if (typeof d.toNumber === "function" && typeof d.toFixed === "function") return Number(d.toString());
    if (Array.isArray(v)) return v.map(walk);
    const out: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) out[k] = walk(val);
    return out;
  };
  return walk(value) as Plain<T>;
}
