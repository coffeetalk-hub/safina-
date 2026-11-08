import { NextRequest } from "next/server";
import React from "react";
import { getTranslations } from "next-intl/server";
import { getSession, can } from "@/core/auth/session";
import { parseListParams } from "@/components/data-table/types";
import { getExporter } from "@/core/export/registry";
import { ListReportPdf } from "@/core/pdf/list-report";
import { renderPdf, pdfResponse } from "@/core/pdf/base";
import { companyHeader } from "@/modules/foundation/settings/service";
import "@/core/export/exporters";

/** Prints any registered list view as a PDF report with the company header. */
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
  params.pageSize = 5000;
  params.page = 1;
  const cols = (sp.cols ?? "").split(",").filter(Boolean);
  const all = await exporter.columns(locale);
  const columns = (cols.length ? all.filter((c) => cols.includes(c.key)) : all.filter((c) => !c.hidden)).slice(0, 12);
  const rows = await exporter.load(session, params, locale);
  const te = await getTranslations({ locale, namespace: "enums" });
  const { company, logoDataUrl } = await companyHeader(session.companyId);
  const element = React.createElement(ListReportPdf, {
    company: { ...company, logoDataUrl },
    titleAr: exporter.sheetName("ar"),
    titleEn: exporter.sheetName("en"),
    columns,
    rows,
    locale,
    enumLabel: (e, v) => (te.has(`${e}.${v}`) ? te(`${e}.${v}`) : v),
    printedBy: locale === "ar" ? session.nameAr : session.nameEn,
  });
  return pdfResponse(await renderPdf(element), `${resource}-${new Date().toISOString().slice(0, 10)}`);
}
