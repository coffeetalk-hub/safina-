import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { flushEmailOutbox, renderEmail } from "@/core/notifications";

export type ResetRealm = "STAFF" | "PORTAL";

const TOKEN_TTL_MS = 60 * 60 * 1000;
const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

async function findAccount(realm: ResetRealm, email: string) {
  return realm === "STAFF"
    ? prisma.user.findFirst({ where: { email, isActive: true }, select: { id: true, email: true, locale: true } })
    : prisma.portalUser.findFirst({ where: { email, isActive: true }, select: { id: true, email: true, locale: true } });
}

/** Emails a single-use link when the account exists. Says nothing either way, so addresses can't be probed. */
export async function requestPasswordReset(realm: ResetRealm, rawEmail: string, requestLocale: string, baseUrl: string) {
  const account = await findAccount(realm, rawEmail.toLowerCase());
  if (!account) return;
  const token = randomBytes(32).toString("base64url");
  await prisma.passwordResetToken.deleteMany({ where: { realm, subjectId: account.id } });
  await prisma.passwordResetToken.create({ data: { realm, subjectId: account.id, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + TOKEN_TTL_MS) } });
  const locale = account.locale === "en" || account.locale === "ar" ? account.locale : requestLocale;
  const ar = locale === "ar";
  const title = ar ? "إعادة تعيين كلمة المرور" : "Reset your password";
  const body = ar
    ? "استخدم الرابط أدناه خلال ساعة لتعيين كلمة مرور جديدة. إذا لم تطلب ذلك يمكنك تجاهل هذه الرسالة."
    : "Use the link below within one hour to set a new password. If you did not ask for this, you can ignore this email.";
  await prisma.emailOutbox.create({ data: { to: account.email, subject: title, html: renderEmail(title, body, `${baseUrl}/${locale}/reset-password?token=${token}`, ar) } });
  // Send now rather than waiting for the scheduled flush; a failure stays queued and is retried.
  await flushEmailOutbox(5).catch((e) => console.error("[email] immediate flush failed", e));
}

/** Sets the new password, unlocks the account and signs out every existing session. Returns the realm, or null for a bad token. */
export async function completePasswordReset(token: string, password: string): Promise<ResetRealm | null> {
  const row = await prisma.passwordResetToken.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!row || row.usedAt || row.expiresAt < new Date()) return null;
  const passwordHash = await bcrypt.hash(password, 10);
  const account = { passwordHash, failedLogins: 0, lockedUntil: null, passwordChangedAt: new Date() };
  const realm = row.realm as ResetRealm;
  await prisma.$transaction(async (tx) => {
    const claimed = await tx.passwordResetToken.updateMany({ where: { id: row.id, usedAt: null }, data: { usedAt: new Date() } });
    if (claimed.count === 0) throw new Error("RESET_TOKEN_INVALID");
    if (realm === "STAFF") {
      await tx.user.update({ where: { id: row.subjectId }, data: account });
      await tx.auditLog.create({ data: { userId: row.subjectId, entity: "User", entityId: row.subjectId, action: "UPDATE", after: { event: "PASSWORD_RESET" } } });
    } else {
      await tx.portalUser.update({ where: { id: row.subjectId }, data: account });
    }
  });
  return realm;
}
