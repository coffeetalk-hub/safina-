import { prisma } from "@/lib/prisma";
import { runCronJob } from "./index";
import { isDue, SCHEDULE } from "./schedule";

const RETRY_AFTER_MS = 30 * 60 * 1000;

/**
 * Runs whatever is due. Each job is claimed with a compare-and-set on lastRunAt, so
 * overlapping ticks or replicas never run it twice. A failed job is retried after 30 minutes.
 */
export async function runDueJobs(now = new Date()) {
  await prisma.scheduledJob.createMany({ data: SCHEDULE.map(({ job }) => ({ job })), skipDuplicates: true });
  const rows = await prisma.scheduledJob.findMany();
  const results: Record<string, "ok" | "failed"> = {};
  for (const schedule of SCHEDULE) {
    const row = rows.find((r) => r.job === schedule.job);
    if (!row || (row.retryAfter && row.retryAfter > now) || !isDue(schedule, row.lastRunAt, now)) continue;
    const claimed = await prisma.scheduledJob.updateMany({ where: { job: row.job, lastRunAt: row.lastRunAt }, data: { lastRunAt: now, retryAfter: null } });
    if (claimed.count === 0) continue;
    try {
      await runCronJob(row.job);
      await prisma.scheduledJob.update({ where: { job: row.job }, data: { lastStatus: "OK", lastError: null } });
      results[row.job] = "ok";
    } catch (e) {
      console.error(`[cron] ${row.job} failed`, e);
      await prisma.scheduledJob.update({ where: { job: row.job }, data: { lastRunAt: row.lastRunAt, retryAfter: new Date(now.getTime() + RETRY_AFTER_MS), lastStatus: "FAILED", lastError: String(e).slice(0, 2000) } });
      results[row.job] = "failed";
    }
  }
  return results;
}

/** Drops expired rate-limit counters and reset tokens. */
export async function pruneExpired() {
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [limits, tokens] = await Promise.all([
    prisma.rateLimit.deleteMany({ where: { windowStart: { lt: dayAgo } } }),
    prisma.passwordResetToken.deleteMany({ where: { expiresAt: { lt: dayAgo } } }),
  ]);
  return { rateLimits: limits.count, resetTokens: tokens.count };
}
