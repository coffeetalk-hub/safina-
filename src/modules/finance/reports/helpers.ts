import type { ListParams } from "@/components/data-table/types";
import type { ReportFilter } from "./service";
import { monthRange, yearRange } from "../_shared/page-helpers";

/** Parses report filters from list params with sensible defaults (current fiscal year to date). */
export function reportFilter(p: ListParams, defaults: "year" | "month" = "year"): ReportFilter & { fromIso: string; toIso: string } {
  const d = defaults === "year" ? yearRange() : monthRange();
  const fromIso = p.filters.from || d.from;
  const toIso = p.filters.to || new Date().toISOString().slice(0, 10);
  return { from: new Date(fromIso), to: new Date(toIso), branchId: p.filters.branchId || null, costCenterId: p.filters.costCenterId || null, fromIso, toIso };
}
