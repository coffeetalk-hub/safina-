import { prisma } from "@/lib/prisma";

/**
 * Fixed-window counters kept in Postgres, so limits survive restarts and redeploys.
 * Callers check before doing expensive work and record only attempts that should count.
 */
export async function isRateLimited(key: string, limit: number, windowSeconds: number): Promise<boolean> {
  const rows = await prisma.$queryRaw<{ count: number }[]>`
    SELECT "count" FROM "RateLimit"
    WHERE "key" = ${key} AND "windowStart" > now() - make_interval(secs => ${windowSeconds}::double precision)`;
  return (rows[0]?.count ?? 0) >= limit;
}

export async function recordAttempt(key: string, windowSeconds: number): Promise<void> {
  await prisma.$executeRaw`
    INSERT INTO "RateLimit" ("key", "windowStart", "count") VALUES (${key}, now(), 1)
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "RateLimit"."windowStart" <= now() - make_interval(secs => ${windowSeconds}::double precision) THEN 1 ELSE "RateLimit"."count" + 1 END,
      "windowStart" = CASE WHEN "RateLimit"."windowStart" <= now() - make_interval(secs => ${windowSeconds}::double precision) THEN now() ELSE "RateLimit"."windowStart" END`;
}
