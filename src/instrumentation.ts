import { SERVERLESS_BUILD } from "@/lib/hosting";
import { storageDriver } from "@/core/attachments/driver";

/** Runs once when the server starts. */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.NODE_ENV !== "production") return;

  const required = ["DATABASE_URL", "AUTH_SECRET", "CRON_SECRET"];
  // On Netlify, sign-in follows the request host and email links use the site URL Netlify provides.
  if (!(SERVERLESS_BUILD && process.env.URL)) required.push("AUTH_URL");
  if (storageDriver() === "disk") required.push("STORAGE_DIR");
  for (const name of required) {
    if (!process.env[name]) console.error(`[startup] ${name} is not set`);
  }
  if (!process.env.RESEND_API_KEY && !process.env.SMTP_HOST) {
    console.error("[startup] No email provider configured (RESEND_API_KEY or SMTP_HOST): emails stay queued and password reset cannot deliver links");
  }

  const secret = process.env.CRON_SECRET;
  // Serverless functions (Netlify runs on AWS Lambda) freeze between requests, so a timer here never fires
  // reliably. There, netlify/functions/cron-tick.mts calls /api/cron/tick on a schedule instead.
  const serverless = SERVERLESS_BUILD || Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME);
  if (!secret || serverless || process.env.DISABLE_SCHEDULER === "true") return;
  const url = `http://127.0.0.1:${process.env.PORT ?? "3000"}/api/cron/tick`;
  const tick = () =>
    fetch(url, { headers: { authorization: `Bearer ${secret}` } })
      .then((r) => { if (!r.ok) console.error(`[scheduler] tick returned ${r.status}`); })
      .catch((e) => console.error("[scheduler] tick failed", e));
  setTimeout(tick, 30_000).unref();
  setInterval(tick, 60_000).unref();
}

/** Server errors reach the host's logs (Railway, Netlify) with the route that failed. */
export function onRequestError(error: unknown, request: { path: string; method: string }) {
  console.error(JSON.stringify({
    level: "error",
    message: error instanceof Error ? error.message : String(error),
    digest: (error as { digest?: string })?.digest,
    stack: error instanceof Error ? error.stack : undefined,
    method: request.method,
    path: request.path.split("?")[0],
  }));
}
