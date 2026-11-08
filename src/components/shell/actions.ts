"use server";

import { cookies, headers } from "next/headers";
import { ACTIVE_COMPANY_COOKIE, ACTIVE_BRANCH_COOKIE, getSession } from "@/core/auth/session";
import { prisma } from "@/lib/prisma";

async function overHttps() {
  return (await headers()).get("x-forwarded-proto") === "https";
}

export async function switchCompanyAction(companyId: string) {
  const s = await getSession();
  if (!s || !s.companyIds.includes(companyId)) return { ok: false };
  const jar = await cookies();
  jar.set(ACTIVE_COMPANY_COOKIE, companyId, { path: "/", httpOnly: true, sameSite: "lax", secure: await overHttps(), maxAge: 60 * 60 * 24 * 365 });
  jar.delete(ACTIVE_BRANCH_COOKIE);
  await prisma.user.update({ where: { id: s.userId }, data: { defaultCompanyId: companyId } });
  return { ok: true };
}

export async function switchBranchAction(branchId: string | null) {
  const s = await getSession();
  if (!s) return { ok: false };
  const jar = await cookies();
  if (!branchId) jar.delete(ACTIVE_BRANCH_COOKIE);
  else {
    const b = await prisma.branch.findFirst({ where: { id: branchId, companyId: s.companyId } });
    if (!b) return { ok: false };
    jar.set(ACTIVE_BRANCH_COOKIE, branchId, { path: "/", httpOnly: true, sameSite: "lax", secure: await overHttps() });
  }
  return { ok: true };
}

export async function switchLocaleAction(locale: "ar" | "en") {
  const s = await getSession();
  if (!s) return { ok: false };
  await prisma.user.update({ where: { id: s.userId }, data: { locale } });
  return { ok: true };
}
