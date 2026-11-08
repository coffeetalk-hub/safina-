import { prisma, type Db } from "@/lib/prisma";
import { appBaseUrl } from "@/lib/base-url";

export type NotifyInput = {
  companyId?: string | null;
  userId: string;
  type: string;
  titleAr: string;
  titleEn: string;
  bodyAr?: string;
  bodyEn?: string;
  link?: string;
  entityType?: string;
  entityId?: string;
  /** Also queue an email to the user's address. */
  email?: boolean;
};

/** Creates an in-app notification and (optionally) queues an email in the outbox. */
export async function notify(tx: Db, input: NotifyInput) {
  const n = await tx.notification.create({
    data: {
      companyId: input.companyId ?? null,
      userId: input.userId,
      type: input.type,
      titleAr: input.titleAr,
      titleEn: input.titleEn,
      bodyAr: input.bodyAr,
      bodyEn: input.bodyEn,
      link: input.link,
      entityType: input.entityType,
      entityId: input.entityId,
    },
  });
  if (input.email) {
    const user = await tx.user.findUnique({ where: { id: input.userId }, select: { email: true, locale: true } });
    if (user?.email) {
      const ar = user.locale === "ar";
      await tx.emailOutbox.create({
        data: {
          companyId: input.companyId ?? null,
          to: user.email,
          subject: ar ? input.titleAr : input.titleEn,
          html: renderEmail(ar ? input.titleAr : input.titleEn, ar ? input.bodyAr : input.bodyEn, input.link, ar),
        },
      });
    }
  }
  return n;
}

export function renderEmail(title: string, body: string | undefined, link: string | undefined, rtl: boolean) {
  const base = appBaseUrl();
  const href = link ? (link.startsWith("http") ? link : `${base}${link}`) : base;
  return `<!doctype html><html dir="${rtl ? "rtl" : "ltr"}"><body style="font-family:Arial,sans-serif;background:#f6f7f9;padding:24px">
  <div style="max-width:560px;margin:auto;background:#fff;border-radius:8px;padding:24px;border:1px solid #e5e7eb">
    <h2 style="margin:0 0 12px;color:#1e3a5f">Safina ERP</h2>
    <h3 style="margin:0 0 8px">${escapeHtml(title)}</h3>
    ${body ? `<p style="color:#374151">${escapeHtml(body)}</p>` : ""}
    <p><a href="${href}" style="display:inline-block;background:#1e3a5f;color:#fff;text-decoration:none;padding:10px 16px;border-radius:6px">${rtl ? "فتح" : "Open"}</a></p>
  </div></body></html>`;
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

type OutgoingEmail = { to: string; subject: string; html: string };

/** Resend over HTTPS when RESEND_API_KEY is set, otherwise SMTP, otherwise null. */
export async function emailSender(): Promise<((m: OutgoingEmail) => Promise<void>) | null> {
  const from = process.env.EMAIL_FROM ?? process.env.SMTP_FROM ?? "Safina ERP <no-reply@localhost>";
  const apiKey = process.env.RESEND_API_KEY;
  if (apiKey) {
    return async (m) => {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
        body: JSON.stringify({ from, to: [m.to], subject: m.subject, html: m.html }),
      });
      if (!res.ok) throw new Error(`Resend responded ${res.status}: ${(await res.text()).slice(0, 500)}`);
    };
  }
  const host = process.env.SMTP_HOST;
  if (!host) return null;
  const nodemailer = await import("nodemailer");
  const port = Number(process.env.SMTP_PORT ?? 587);
  const transport = nodemailer.createTransport({ host, port, secure: port === 465, auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined });
  return async (m) => { await transport.sendMail({ from, to: m.to, subject: m.subject, html: m.html }); };
}

/** Processes pending emails. Called by the scheduler and from /api/cron/email. */
export async function flushEmailOutbox(limit = 50) {
  const pending = await prisma.emailOutbox.findMany({ where: { status: "PENDING", attempts: { lt: 5 } }, take: limit, orderBy: { createdAt: "asc" } });
  if (pending.length === 0) return { sent: 0, failed: 0 };
  const send = await emailSender();
  if (!send) {
    if (process.env.NODE_ENV === "production") {
      // Keep the mail queued: it goes out as soon as a provider is configured.
      console.error(`[email] ${pending.length} queued, no provider configured (RESEND_API_KEY or SMTP_HOST)`);
      return { sent: 0, failed: 0, queued: pending.length };
    }
    await prisma.emailOutbox.updateMany({ where: { id: { in: pending.map((p) => p.id) } }, data: { status: "SENT", sentAt: new Date(), lastError: "No email provider (dev mode)" } });
    return { sent: pending.length, failed: 0 };
  }
  let sent = 0, failed = 0;
  for (const m of pending) {
    try {
      await send({ to: m.to, subject: m.subject, html: m.html });
      await prisma.emailOutbox.update({ where: { id: m.id }, data: { status: "SENT", sentAt: new Date(), attempts: { increment: 1 } } });
      sent++;
    } catch (e) {
      failed++;
      await prisma.emailOutbox.update({ where: { id: m.id }, data: { attempts: { increment: 1 }, lastError: String(e), status: m.attempts + 1 >= 5 ? "FAILED" : "PENDING" } });
    }
  }
  return { sent, failed };
}
