import type { ColumnDef, ListParams } from "@/components/data-table/types";
import type { AppSession } from "@/core/auth/session";

/**
 * Each list view registers an exporter: a permission, column set and a loader that
 * reuses the same query as the screen (without pagination).
 */
export type Exporter = {
  /** Any one of these grants the export; the loader still applies row-level scope. */
  permission: string | readonly string[];
  columns: (locale: string) => Promise<ColumnDef[]> | ColumnDef[];
  load: (session: AppSession, params: ListParams, locale: string) => Promise<Record<string, unknown>[]>;
  sheetName: (locale: string) => string;
};

const registry = new Map<string, () => Promise<Exporter>>();

export function registerExporter(resource: string, loader: () => Promise<Exporter>) {
  registry.set(resource, loader);
}

export async function getExporter(resource: string): Promise<Exporter | null> {
  const l = registry.get(resource);
  return l ? l() : null;
}

/** Helper to build an exporter from a crud service + column factory. */
export function crudExporter(opts: {
  permission: string;
  columns: (tf: (k: string) => string, locale: string) => ColumnDef[];
  load: Exporter["load"];
  sheetAr: string;
  sheetEn: string;
}): Exporter {
  return {
    permission: opts.permission,
    columns: async (locale) => {
      const { getTranslations } = await import("next-intl/server");
      const tf = await getTranslations({ locale, namespace: "fields" });
      return opts.columns((k) => tf(k), locale);
    },
    load: opts.load,
    sheetName: (locale) => (locale === "ar" ? opts.sheetAr : opts.sheetEn),
  };
}
