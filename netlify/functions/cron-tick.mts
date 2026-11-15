/**
 * Netlify Scheduled Function: runs Safina's background jobs (email outbox, recurring journals,
 * document and expiry alerts, depreciation, maintenance) by calling /api/cron/tick every 5 minutes.
 * The tick catches up anything missed, so the interval only sets how quickly queued emails go out.
 * Needs CRON_SECRET in the Netlify UI with the Functions scope. Netlify fires it on published deploys only.
 */
async function cronTick() {
  const base = process.env.URL;
  const secret = process.env.CRON_SECRET;
  if (!base || !secret) {
    console.error("[cron-tick] URL or CRON_SECRET is not set");
    return;
  }
  const res = await fetch(`${base}/api/cron/tick`, { headers: { authorization: `Bearer ${secret}` } });
  if (!res.ok) console.error(`[cron-tick] /api/cron/tick returned ${res.status}`);
}

export default cronTick;

export const config = { schedule: "*/5 * * * *" };
