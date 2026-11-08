import { createHash, timingSafeEqual } from "node:crypto";
import { NextRequest } from "next/server";
import { flushEmailOutbox } from "@/core/notifications";
import { registerCronJob, runCronJob } from "@/core/cron";
import { pruneExpired, runDueJobs } from "@/core/cron/runner";
import "@/modules/finance/register";

registerCronJob("email", flushEmailOutbox);
registerCronJob("maintenance", pruneExpired);

const digest = (s: string) => createHash("sha256").update(s).digest();

function authorized(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const provided = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  return Boolean(secret && provided && timingSafeEqual(digest(provided), digest(secret)));
}

/**
 * Background jobs, protected by `Authorization: Bearer <CRON_SECRET>`.
 * `tick` runs everything due and is what the built-in scheduler calls every minute.
 * Any other name runs that one job immediately, e.g. email | depreciation | recurring-journals.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ job: string }> }) {
  if (!authorized(req)) return new Response("Unauthorized", { status: 401 });
  const { job } = await ctx.params;
  if (job === "tick") return Response.json(await runDueJobs());
  const result = await runCronJob(job);
  if (result === null) return new Response("Unknown job", { status: 404 });
  return Response.json(result);
}

export const POST = GET;
