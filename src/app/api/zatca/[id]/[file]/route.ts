import { NextRequest } from "next/server";
import QRCode from "qrcode";
import { getSession, can } from "@/core/auth/session";
import { prisma } from "@/lib/prisma";

/** /api/zatca/[invoiceId]/qr.png | xml — ZATCA artefacts for an invoice. */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string; file: string }> }) {
  const { id, file } = await ctx.params;
  const session = await getSession();
  if (!session) return new Response("Unauthorized", { status: 401 });
  if (!can(session, "finance.invoice:view")) return new Response("Forbidden", { status: 403 });
  const doc = await prisma.zatcaDocument.findFirst({ where: { invoiceId: id, companyId: session.companyId }, include: { invoice: { select: { number: true } } } });
  if (!doc) return new Response("Not found", { status: 404 });
  if (file === "qr.png") {
    const png = await QRCode.toBuffer(doc.qrBase64, { type: "png", width: 300, margin: 1 });
    return new Response(new Uint8Array(png), { headers: { "Content-Type": "image/png", "Cache-Control": "private, max-age=3600" } });
  }
  if (file === "xml") {
    return new Response(doc.xml, { headers: { "Content-Type": "application/xml; charset=utf-8", "Content-Disposition": `inline; filename="${doc.invoice.number}.xml"` } });
  }
  return new Response("Not found", { status: 404 });
}
