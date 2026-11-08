import { NextRequest } from "next/server";
import { getSession, can } from "@/core/auth/session";
import { buildTemplate } from "@/core/import";
import { IMPORTS } from "@/modules/foundation/import/definitions";
import { excelResponse } from "@/core/export/excel";

export async function GET(req: NextRequest, ctx: { params: Promise<{ entity: string }> }) {
  const { entity } = await ctx.params;
  const session = await getSession();
  if (!session) return new Response("Unauthorized", { status: 401 });
  const def = IMPORTS[entity];
  if (!def) return new Response("Not found", { status: 404 });
  if (!can(session, def.permission)) return new Response("Forbidden", { status: 403 });
  const locale = req.nextUrl.searchParams.get("locale") === "en" ? "en" : "ar";
  return excelResponse(await buildTemplate(def, locale), `template-${entity}`);
}
