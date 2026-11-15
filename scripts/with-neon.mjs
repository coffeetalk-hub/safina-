/**
 * Runs one command against the Neon database in .env.local (written by `neon env pull`),
 * over the direct connection, which migrations and admin scripts need. Transactions get 2 minutes,
 * because every query is a round trip from this machine to Neon.
 * The Prisma CLI and the seed scripts only read .env, so without this they target local Docker.
 *
 *   npm run neon -- npx prisma migrate deploy
 *   npm run neon -- npm run db:seed:team
 *
 * Connection strings are never printed.
 */
import { existsSync, readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { spawnSync } from "node:child_process";

if (!existsSync(".env.local")) {
  console.error("[neon] .env.local not found. Run `neon env pull --file .env.local` first.");
  process.exit(1);
}
const vars = parseEnv(readFileSync(".env.local", "utf8"));
const direct = vars.DATABASE_URL_UNPOOLED ?? vars.DATABASE_URL;
if (!direct) {
  console.error("[neon] .env.local has no DATABASE_URL_UNPOOLED or DATABASE_URL.");
  process.exit(1);
}
const command = process.argv.slice(2);
if (command.length === 0) {
  console.error("Usage: npm run neon -- <command>");
  process.exit(1);
}
console.log(`[neon] Running against Neon branch ${vars.NEON_BRANCH ?? "(unknown)"}: ${command.join(" ")}`);
const result = spawnSync(command.join(" "), { stdio: "inherit", shell: true, env: { PRISMA_TX_TIMEOUT_MS: "120000", ...process.env, ...vars, DATABASE_URL: direct } });
process.exit(result.status ?? 1);
