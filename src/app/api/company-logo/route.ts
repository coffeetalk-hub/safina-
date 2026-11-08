import { getSession } from "@/core/auth/session";
import { prisma } from "@/lib/prisma";
import { storage } from "@/core/attachments/storage";

export async function GET() {
  const session = await getSession();
  if (!session) return new Response("Unauthorized", { status: 401 });
  const c = await prisma.company.findUnique({ where: { id: session.companyId }, select: { logoKey: true } });
  if (!c?.logoKey) return new Response("Not found", { status: 404 });
  const buf = await storage.get(c.logoKey);
  const mime = c.logoKey.endsWith(".png") ? "image/png" : c.logoKey.endsWith(".webp") ? "image/webp" : "image/jpeg";
  return new Response(new Uint8Array(buf), { headers: { "Content-Type": mime, "Cache-Control": "private, max-age=60" } });
}
