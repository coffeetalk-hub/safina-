import { NextRequest } from "next/server";
import { getPortalSession, type AppSession } from "@/core/auth/session";
import { prisma } from "@/lib/prisma";
import { invoicePdf } from "@/modules/finance/pdf/generators";
import { renderPdf, pdfResponse } from "@/core/pdf/base";

/** Customer-portal invoice PDF: only the customer's own posted invoices. */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const ps = await getPortalSession();
  if (!ps) return new Response("Unauthorized", { status: 401 });
  const inv = await prisma.customerInvoice.findFirst({ where: { id, companyId: ps.companyId, customerId: ps.customerId, status: { in: ["POSTED", "PARTIALLY_PAID", "PAID"] } }, select: { id: true } });
  if (!inv) return new Response("Not found", { status: 404 });
  const locale = req.nextUrl.searchParams.get("locale") === "en" ? "en" : "ar";
  const synthetic = { companyId: ps.companyId, nameAr: ps.nameAr, nameEn: ps.nameEn } as AppSession;
  const out = await invoicePdf.render(synthetic, id, locale);
  if (!out) return new Response("Not found", { status: 404 });
  return pdfResponse(await renderPdf(out.element), out.fileName, true);
}
