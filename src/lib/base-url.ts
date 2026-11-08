/** Public origin of the app, used for links in emails. */
export function appBaseUrl(): string {
  if (process.env.AUTH_URL) return process.env.AUTH_URL.replace(/\/+$/, "");
  if (process.env.RAILWAY_PUBLIC_DOMAIN) return `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`;
  return "http://localhost:3000";
}
