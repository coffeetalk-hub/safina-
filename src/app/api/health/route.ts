import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** Used by Railway's deployment health check: healthy only when the database answers. */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return Response.json({ status: "ok" });
  } catch (e) {
    console.error("[health] database check failed", e);
    return Response.json({ status: "unavailable" }, { status: 503 });
  }
}
