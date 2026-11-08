/** Client address behind Railway's edge, which sets X-Real-IP; X-Forwarded-For is the fallback for other proxies. */
export function clientIp(headers: Pick<Headers, "get">): string | null {
  return headers.get("x-real-ip")?.trim() || headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
}
