"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { clientIp } from "@/core/auth/client-ip";
import { isRateLimited, recordAttempt } from "@/core/auth/rate-limit";
import { appBaseUrl } from "@/lib/base-url";
import { completePasswordReset, requestPasswordReset } from "./service";

const HOUR = 60 * 60;
const requestSchema = z.object({ email: z.string().trim().email().max(200), realm: z.enum(["STAFF", "PORTAL"]), locale: z.enum(["ar", "en"]) });
const resetSchema = z.object({ token: z.string().min(20).max(200), password: z.string().min(8).max(100) });

/** Public: always reports success so the form can't be used to discover registered addresses. */
export async function requestPasswordResetAction(input: unknown): Promise<{ ok: true }> {
  const parsed = requestSchema.safeParse(input);
  if (!parsed.success) return { ok: true };
  const { email, realm, locale } = parsed.data;
  const ipKey = `reset:ip:${clientIp(await headers()) ?? "unknown"}`;
  const emailKey = `reset:email:${email.toLowerCase()}`;
  if ((await isRateLimited(ipKey, 10, HOUR)) || (await isRateLimited(emailKey, 3, HOUR))) return { ok: true };
  await Promise.all([recordAttempt(ipKey, HOUR), recordAttempt(emailKey, HOUR)]);
  await requestPasswordReset(realm, email, locale, appBaseUrl());
  return { ok: true };
}

/** Public: the single-use token is the credential. */
export async function resetPasswordAction(input: unknown): Promise<{ ok: true; realm: "STAFF" | "PORTAL" } | { ok: false; error: "INVALID_PASSWORD" | "RESET_TOKEN_INVALID" }> {
  const parsed = resetSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "INVALID_PASSWORD" };
  const ipKey = `reset-submit:${clientIp(await headers()) ?? "unknown"}`;
  if (await isRateLimited(ipKey, 20, HOUR)) return { ok: false, error: "RESET_TOKEN_INVALID" };
  await recordAttempt(ipKey, HOUR);
  const realm = await completePasswordReset(parsed.data.token, parsed.data.password).catch(() => null);
  return realm ? { ok: true, realm } : { ok: false, error: "RESET_TOKEN_INVALID" };
}
