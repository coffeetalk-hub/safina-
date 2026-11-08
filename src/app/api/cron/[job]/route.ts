import { NextRequest } from "next/server";
import { flushEmailOutbox } from "@/core/notifications";
import { runCronJob } from "@/core/cron";
import "@/modules/finance/register";

/**
 * Scheduled jobs. Protect with CRON_SECRET (Authorization: Bearer <secret> or ?secret=).
 * Jobs: email | expiry-alerts | recurring-journals | depreciation (later modules register theirs).
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ job: string }> }) {
  const { job } = await ctx.params;
  const secret = process.env.CRON_SECRET;
  const provided = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? req.nextUrl.searchParams.get("secret");
  if (!secret || provided !== secret) return new Response("Unauthorized", { status: 401 });
  if (job === "email") return Response.json(await flushEmailOutbox());
  const result = await runCronJob(job);
  if (result === null) return new Response("Unknown job", { status: 404 });
  return Response.json(result);
}

export const POST = GET;
