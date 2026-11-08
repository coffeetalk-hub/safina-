import { NextRequest } from "next/server";
import { getSession, can } from "@/core/auth/session";
import { getWps } from "@/modules/hr/payroll";

/** Download the generated WPS salary file for a payroll run. */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ runId: string }> }) {
  const { runId } = await ctx.params;
  const session = await getSession();
  if (!session) return new Response("Unauthorized", { status: 401 });
  if (!can(session, "hr.wps:view")) return new Response("Forbidden", { status: 403 });
  const f = await getWps(session, runId);
  if (!f) return new Response("Not found", { status: 404 });
  return new Response("﻿" + f.content, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${f.fileName}"` } });
}
