import NextAuth, { type DefaultSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { clientIp } from "./client-ip";
import { isRateLimited, recordAttempt } from "./rate-limit";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      nameAr: string;
      nameEn: string;
      locale: string;
      isSuperAdmin: boolean;
      companyIds: string[];
      activeCompanyId: string | null;
      portal?: boolean;
      customerId?: string;
      companyId?: string;
      tokenIssuedAt?: number;
    } & DefaultSession["user"];
  }
}

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const MAX_FAILED = 5;
const LOCK_MINUTES = 15;
const IP_ATTEMPTS = 30;
const IP_WINDOW_SECONDS = 15 * 60;

const ipKey = (request: Request) => `login:${clientIp(request.headers) ?? "unknown"}`;

let dummyHash: Promise<string> | undefined;
/** Spends the same time as a real check, so response timing doesn't reveal which emails exist. */
async function burnPasswordCheck(password: string) {
  await bcrypt.compare(password, await (dummyHash ??= bcrypt.hash("no-such-account", 10)));
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt", maxAge: 12 * 60 * 60 },
  pages: { signIn: "/login" },
  trustHost: true,
  providers: [
    Credentials({
      id: "portal",
      name: "Customer portal",
      credentials: { email: {}, password: {} },
      async authorize(raw, request) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;
        const ip = ipKey(request);
        if (await isRateLimited(ip, IP_ATTEMPTS, IP_WINDOW_SECONDS)) return null;
        const u = await prisma.portalUser.findFirst({ where: { email: parsed.data.email.toLowerCase(), isActive: true }, include: { customer: { select: { nameAr: true, nameEn: true, isActive: true } } } });
        if (!u || !u.customer.isActive) {
          await burnPasswordCheck(parsed.data.password);
          await recordAttempt(ip, IP_WINDOW_SECONDS);
          return null;
        }
        if (u.lockedUntil && u.lockedUntil > new Date()) {
          await recordAttempt(ip, IP_WINDOW_SECONDS);
          return null;
        }
        if (!(await bcrypt.compare(parsed.data.password, u.passwordHash))) {
          const failed = u.failedLogins + 1;
          await prisma.portalUser.update({ where: { id: u.id }, data: { failedLogins: failed, lockedUntil: failed >= MAX_FAILED ? new Date(Date.now() + LOCK_MINUTES * 60_000) : null } });
          await recordAttempt(ip, IP_WINDOW_SECONDS);
          return null;
        }
        await prisma.portalUser.update({ where: { id: u.id }, data: { failedLogins: 0, lockedUntil: null, lastLoginAt: new Date() } });
        return { id: `portal:${u.id}`, email: u.email, name: u.name, nameAr: u.customer.nameAr, nameEn: u.customer.nameEn, locale: u.locale, isSuperAdmin: false, companyIds: [], activeCompanyId: null, portal: true, customerId: u.customerId, companyId: u.companyId } as unknown as import("next-auth").User;
      },
    }),
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(raw, request) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;
        const { email, password } = parsed.data;
        const ip = ipKey(request);
        if (await isRateLimited(ip, IP_ATTEMPTS, IP_WINDOW_SECONDS)) return null;
        const user = await prisma.user.findFirst({
          where: { email: email.toLowerCase(), isActive: true },
          include: { companies: { select: { companyId: true, isDefault: true } } },
        });
        if (!user) {
          await burnPasswordCheck(password);
          await recordAttempt(ip, IP_WINDOW_SECONDS);
          return null;
        }
        if (user.lockedUntil && user.lockedUntil > new Date()) {
          await recordAttempt(ip, IP_WINDOW_SECONDS);
          return null;
        }
        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) {
          await recordAttempt(ip, IP_WINDOW_SECONDS);
          const failed = user.failedLogins + 1;
          await prisma.user.update({
            where: { id: user.id },
            data: {
              failedLogins: failed,
              lockedUntil: failed >= MAX_FAILED ? new Date(Date.now() + LOCK_MINUTES * 60_000) : null,
            },
          });
          return null;
        }
        await prisma.user.update({
          where: { id: user.id },
          data: { failedLogins: 0, lockedUntil: null, lastLoginAt: new Date() },
        });
        await prisma.auditLog.create({
          data: { userId: user.id, entity: "User", entityId: user.id, action: "LOGIN" },
        });
        const companyIds = user.companies.map((c) => c.companyId);
        const active =
          user.defaultCompanyId && companyIds.includes(user.defaultCompanyId)
            ? user.defaultCompanyId
            : user.companies.find((c) => c.isDefault)?.companyId ?? companyIds[0] ?? null;
        return {
          id: user.id,
          email: user.email,
          name: user.nameEn,
          nameAr: user.nameAr,
          nameEn: user.nameEn,
          locale: user.locale,
          isSuperAdmin: user.isSuperAdmin,
          companyIds,
          activeCompanyId: active,
        } as unknown as import("next-auth").User;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        const u = user as unknown as Record<string, unknown>;
        token.id = u.id;
        token.nameAr = u.nameAr;
        token.nameEn = u.nameEn;
        token.locale = u.locale;
        token.isSuperAdmin = u.isSuperAdmin;
        token.companyIds = u.companyIds;
        token.activeCompanyId = u.activeCompanyId;
        token.portal = u.portal ?? false;
        token.customerId = u.customerId ?? null;
        token.companyId = u.companyId ?? null;
        token.signedInAt = Math.floor(Date.now() / 1000);
      }
      if (trigger === "update" && session) {
        const s = session as Record<string, unknown>;
        if (typeof s.activeCompanyId === "string") token.activeCompanyId = s.activeCompanyId;
        if (typeof s.locale === "string") token.locale = s.locale;
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.id as string;
      session.user.nameAr = token.nameAr as string;
      session.user.nameEn = token.nameEn as string;
      session.user.locale = token.locale as string;
      session.user.isSuperAdmin = Boolean(token.isSuperAdmin);
      session.user.companyIds = (token.companyIds as string[]) ?? [];
      session.user.activeCompanyId = (token.activeCompanyId as string | null) ?? null;
      session.user.portal = Boolean(token.portal);
      session.user.customerId = (token.customerId as string | undefined) ?? undefined;
      session.user.companyId = (token.companyId as string | undefined) ?? undefined;
      session.user.tokenIssuedAt = (token.signedInAt as number | undefined) ?? undefined;
      return session;
    },
  },
});

export async function hashPassword(pw: string) {
  return bcrypt.hash(pw, 10);
}
