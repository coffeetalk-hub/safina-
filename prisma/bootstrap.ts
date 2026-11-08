/**
 * First-run setup for a real deployment: one super admin and one company with the
 * default roles, tax codes and chart of accounts. Does nothing once any user exists,
 * so it is safe to run on every deploy.
 *
 * Reads BOOTSTRAP_ADMIN_EMAIL, BOOTSTRAP_ADMIN_PASSWORD, BOOTSTRAP_COMPANY_NAME_AR,
 * BOOTSTRAP_COMPANY_NAME_EN, BOOTSTRAP_COMPANY_CODE and BOOTSTRAP_COMPANY_VAT.
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { bootstrapCompany } from "../src/modules/foundation/companies/service";
import type { Tx } from "../src/lib/prisma";
import { installChartOfAccounts } from "./seed-data/install-coa";

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.count();
  if (users > 0) {
    console.log("[bootstrap] Users already exist, nothing to do.");
    return;
  }
  const email = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
  if (!email || !password) {
    console.warn("[bootstrap] Empty database and no BOOTSTRAP_ADMIN_EMAIL / BOOTSTRAP_ADMIN_PASSWORD set: nobody can sign in yet.");
    return;
  }
  if (password.length < 12) throw new Error("BOOTSTRAP_ADMIN_PASSWORD must be at least 12 characters");

  const nameEn = process.env.BOOTSTRAP_COMPANY_NAME_EN?.trim() || "My Company";
  const nameAr = process.env.BOOTSTRAP_COMPANY_NAME_AR?.trim() || nameEn;
  const admin = await prisma.user.create({ data: { email, passwordHash: await bcrypt.hash(password, 10), nameAr: "مدير النظام", nameEn: "System Admin", isSuperAdmin: true } });
  const company = await prisma.company.create({ data: { code: process.env.BOOTSTRAP_COMPANY_CODE?.trim() || "MAIN", nameAr, nameEn, vatNumber: process.env.BOOTSTRAP_COMPANY_VAT?.trim() || null } });
  await prisma.$transaction((tx) => bootstrapCompany(tx as unknown as Tx, company.id, admin.id));
  await installChartOfAccounts(prisma, company.id);
  console.log(`[bootstrap] Created super admin ${email} and company ${nameEn}.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
