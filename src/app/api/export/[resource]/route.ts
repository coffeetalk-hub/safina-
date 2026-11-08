import { NextRequest } from "next/server";
import { getTranslations } from "next-intl/server";
import { getSession, can } from "@/core/auth/session";
import { parseListParams } from "@/components/data-table/types";
import { buildExcel, excelResponse } from "@/core/export/excel";
import { getExporter } from "@/core/export/registry";
import "@/core/export/exporters"; // registers all exporters

export async function GET(req: NextRequest, ctx: { params: Promise<{ resource: string }> }) {
  const { resource } = await ctx.params;
  const session = await getSession();
  if (!session) return new Response("Unauthorized", { status: 401 });
  const exporter = await getExporter(resource);
  if (!exporter) return new Response("Unknown resource", { status: 404 });
  if (!can(session, exporter.permission)) return new Response("Forbidden", { status: 403 });

  const sp = Object.fromEntries(req.nextUrl.searchParams.entries());
  const locale = sp.locale === "en" ? "en" : "ar";
  const params = parseListParams(sp);
  params.pageSize = 10_000;
  params.page = 1;
  const cols = (sp.cols ?? "").split(",").filter(Boolean);
  const allColumns = await exporter.columns(locale);
  const columns = cols.length ? allColumns.filter((c) => cols.includes(c.key)) : allColumns.filter((c) => !c.hidden);
  const rows = await exporter.load(session, params, locale);
  const sheet = exporter.sheetName(locale);
  const te = await getTranslations({ locale, namespace: "enums" });
  const buf = await buildExcel({ sheetName: sheet, title: sheet, columns, rows, locale, enumLabels: (e, v) => (te.has(`${e}.${v}`) ? te(`${e}.${v}`) : v) });
  return excelResponse(buf, `${resource}-${new Date().toISOString().slice(0, 10)}`);
}
