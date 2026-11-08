import { NextRequest } from "next/server";
import { getSession, canAny } from "@/core/auth/session";
import { getPdf } from "@/core/pdf/registry";
import { renderPdf, pdfResponse } from "@/core/pdf/base";
import "@/core/pdf/generators";

/** Renders a single document (invoice, payslip, PO…) as PDF. */
export async function GET(req: NextRequest, ctx: { params: Promise<{ doc: string; id: string }> }) {
  const { doc, id } = await ctx.params;
  const session = await getSession();
  if (!session) return new Response("Unauthorized", { status: 401 });
  const gen = await getPdf(doc);
  if (!gen) return new Response("Unknown document", { status: 404 });
  if (!canAny(session, gen.permission)) return new Response("Forbidden", { status: 403 });
  const locale = req.nextUrl.searchParams.get("locale") === "en" ? "en" : "ar";
  const out = await gen.render(session, id, locale);
  if (!out) return new Response("Not found", { status: 404 });
  return pdfResponse(await renderPdf(out.element), out.fileName, req.nextUrl.searchParams.get("download") !== "1");
}
