/**
 * Team accounts: the real people who use this Safina instance, with their access level.
 * Safe to re-run against any database (local Docker, Netlify, Railway). It needs at least
 * one company, so run `npm run db:seed` (demo) or `npm run db:bootstrap` first.
 *
 * - The roster below is the source of truth for these accounts' roles. Re-running puts
 *   each person back on exactly the roles listed here; it does not touch anyone else.
 * - Admins are super admins with the Administrator role in every company.
 * - Finance, sales and purchasing get their role in every company, plus Employee
 *   self-service in the home company. Employees get self-service in the home company.
 * - Everyone gets an employee record in the home company (SAILORS, or TEAM_COMPANY_CODE)
 *   so they can punch in, request leave and see payslips. HR completes the details.
 *   That includes every admin login, so My HR works for them too. A login that must not
 *   have one can be marked employeeRecord: false.
 * - When someone's access changes, their sessions end and they sign in again with the same password.
 *
 * Passwords: each new account gets its own random password, written to
 * TEAM_PASSWORDS_FILE (default ./team-passwords.local.csv, git-ignored). Run it again
 * against another database with the same file and the same passwords are used, so each
 * person has one password everywhere. Existing accounts keep their password unless you
 * pass --reset-passwords. Everyone can change theirs under Profile.
 *
 * Public sites: pass --lock-demo-logins to switch off the demo accounts from `npm run db:seed`,
 * whose password is published in the README. Their demo data stays; re-running the demo seed
 * switches them back on.
 *
 * Run: npm run db:seed:team            (writes to DATABASE_URL)
 *      npm run db:seed:team -- --reset-passwords
 *      npm run db:seed:team -- --lock-demo-logins
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomInt } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { nextDocumentNumber } from "../src/core/numbering";
import { transactionOptionsFromEnv, type Tx } from "../src/lib/prisma";

type Access = "admin" | "finance" | "sales" | "purchasing" | "employee";

/** Names are taken from the email addresses; correct them under Users and Employees. */
const TEAM: { email: string; en: [string, string]; ar: [string, string]; access: Access; employeeRecord?: false }[] = [
  { email: "abdulrahman.albaz@thesailors.ai", en: ["Abdulrahman", "Albaz"], ar: ["عبدالرحمن", "الباز"], access: "employee" },
  { email: "ali.nasser@thesailors.ai", en: ["Ali", "Nasser"], ar: ["علي", "ناصر"], access: "employee" },
  { email: "mohammed.almikail@thesailors.ai", en: ["Mohammed", "Almikail"], ar: ["محمد", "المكيل"], access: "employee" },
  { email: "faisal.aldossary@thesailors.ai", en: ["Faisal", "Aldossary"], ar: ["فيصل", "الدوسري"], access: "employee" },
  { email: "mayada.alsaadi@thesailors.ai", en: ["Mayada", "Alsaadi"], ar: ["ميادة", "السعدي"], access: "employee" },
  { email: "samar.aljindan@thesailors.ai", en: ["Samar", "Aljindan"], ar: ["سمر", "الجندان"], access: "admin" },
  { email: "saleem.bitar@thesailors.ai", en: ["Saleem", "Bitar"], ar: ["سليم", "بيطار"], access: "admin" },
  { email: "abdulrahman.albuhason@thesailors.ai", en: ["Abdulrahman", "Albuhason"], ar: ["عبدالرحمن", "البوحسون"], access: "sales" },
  { email: "muhammad.anwar@thesailors.ai", en: ["Muhammad", "Anwar"], ar: ["محمد", "أنور"], access: "finance" },
  { email: "shahad.almulla@thesailors.ai", en: ["Shahad", "Almulla"], ar: ["شهد", "الملا"], access: "employee" },
  { email: "shahad.alsonaiyen@thesailors.ai", en: ["Shahad", "Alsonaiyen"], ar: ["شهد", "السنيين"], access: "employee" },
  { email: "najd.althumairy@thesailors.ai", en: ["Najd", "Althumairy"], ar: ["نجد", "الثميري"], access: "purchasing" },
  { email: "almaha.almahasher@thesailors.ai", en: ["Almaha", "Almahasher"], ar: ["المها", "المحاشر"], access: "employee" },
  { email: "mohammed.alnemer@thesailors.ai", en: ["Mohammed", "Alnemer"], ar: ["محمد", "النمر"], access: "employee" },
  // Shared admin login until a named administrator takes it over.
  { email: "placeholder.admin@thesailors.ai", en: ["Placeholder", "Admin"], ar: ["مدير", "مؤقت"], access: "admin" },
];

/** Roles held in every company. Non-admins also get EMPLOYEE in the home company. */
const COMPANY_ROLES: Record<Access, string[]> = {
  admin: ["ADMIN"],
  finance: ["FINANCE_MANAGER", "ACCOUNTANT"],
  sales: ["SALES"],
  purchasing: ["PURCHASING"],
  employee: [],
};

/** Demo logins created by prisma/seed.ts and prisma/seed-sales.ts. */
const DEMO_STAFF = ["admin", "finance", "sales", "hr", "purchasing", "employee"].map((u) => `${u}@thesailors.ai`);
const DEMO_PORTAL = ["portal@nakheel.example"];

const prisma = new PrismaClient(transactionOptionsFromEnv());
const PASSWORD_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

function generatePassword() {
  const group = () => Array.from({ length: 4 }, () => PASSWORD_CHARS[randomInt(PASSWORD_CHARS.length)]).join("");
  return `${group()}-${group()}-${group()}`;
}

function readPasswords(file: string) {
  const out = new Map<string, string>();
  if (!existsSync(file)) return out;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/).slice(1)) {
    const [email, , , password] = line.split(",");
    if (email && password) out.set(email.trim().toLowerCase(), password.trim());
  }
  return out;
}

function databaseLabel() {
  try {
    const u = new URL(process.env.DATABASE_URL ?? "");
    return `${u.hostname}:${u.port || "5432"}${u.pathname}`;
  } catch {
    return "(DATABASE_URL not set)";
  }
}

async function main() {
  const resetPasswords = process.argv.includes("--reset-passwords");
  const lockDemo = process.argv.includes("--lock-demo-logins");
  const passwordFile = path.resolve(process.env.TEAM_PASSWORDS_FILE ?? "team-passwords.local.csv");
  const saved = readPasswords(passwordFile);
  console.log(`[team] Database: ${databaseLabel()}`);

  const companies = await prisma.company.findMany({ where: { deletedAt: null, isActive: true }, orderBy: { createdAt: "asc" } });
  if (companies.length === 0) throw new Error("No company yet. Run `npm run db:seed` (demo data) or `npm run db:bootstrap` first.");
  const home = companies.find((c) => c.code === (process.env.TEAM_COMPANY_CODE ?? "SAILORS")) ?? companies[0];
  const roles = await prisma.role.findMany({ where: { companyId: { in: companies.map((c) => c.id) }, deletedAt: null } });
  const roleId = (companyId: string, code: string) => {
    const r = roles.find((x) => x.companyId === companyId && x.code === code);
    if (!r) throw new Error(`Role ${code} is missing in company ${companyId}`);
    return r.id;
  };
  const mainBranch = await prisma.branch.findFirst({ where: { companyId: home.id, isMain: true, deletedAt: null } });

  const rows: { email: string; name: string; access: Access; password: string; status: string; employee: string }[] = [];
  for (const m of TEAM) {
    const email = m.email.trim().toLowerCase();
    const nameEn = `${m.en[0]} ${m.en[1]}`;
    const nameAr = `${m.ar[0]} ${m.ar[1]}`;
    const existing = await prisma.user.findUnique({ where: { email } });
    const password = resetPasswords ? generatePassword() : existing ? null : (saved.get(email) ?? generatePassword());
    const access = { isSuperAdmin: m.access === "admin", isActive: true, deletedAt: null, defaultCompanyId: home.id };
    const user = existing
      ? await prisma.user.update({
          where: { id: existing.id },
          data: { ...access, ...(password ? { passwordHash: await bcrypt.hash(password, 10), passwordChangedAt: new Date(), failedLogins: 0, lockedUntil: null } : {}) },
        })
      : await prisma.user.create({ data: { email, nameEn, nameAr, locale: "ar", passwordHash: await bcrypt.hash(password!, 10), ...access } });

    // Company access: exactly the roles above, nothing left over from an earlier roster.
    const wanted = new Map<string, string[]>();
    for (const c of companies) {
      const codes = [...COMPANY_ROLES[m.access], ...(c.id === home.id && m.access !== "admin" ? ["EMPLOYEE"] : [])];
      if (codes.length) wanted.set(c.id, codes);
    }
    let accessChanges = existing && existing.isSuperAdmin !== access.isSuperAdmin ? 1 : 0;
    const leftCompanies = await prisma.userCompany.deleteMany({ where: { userId: user.id, companyId: { notIn: [...wanted.keys()] } } });
    accessChanges += leftCompanies.count;
    for (const [companyId, codes] of wanted) {
      const uc = await prisma.userCompany.upsert({
        where: { userId_companyId: { userId: user.id, companyId } },
        create: { userId: user.id, companyId, isDefault: companyId === home.id },
        update: { isDefault: companyId === home.id },
      });
      const ids = codes.map((code) => roleId(companyId, code));
      const dropped = await prisma.userCompanyRole.deleteMany({ where: { userCompanyId: uc.id, roleId: { notIn: ids } } });
      const kept = await prisma.userCompanyRole.count({ where: { userCompanyId: uc.id, roleId: { in: ids } } });
      accessChanges += dropped.count + ids.length - kept;
      for (const id of ids) {
        await prisma.userCompanyRole.upsert({ where: { userCompanyId_roleId: { userCompanyId: uc.id, roleId: id } }, create: { userCompanyId: uc.id, roleId: id }, update: {} });
      }
    }

    // Super admin rights travel in the sign-in token, so a changed account is signed out everywhere.
    // The password stays the same; the person signs in again and gets the new access.
    const accessChanged = Boolean(existing && !password && accessChanges > 0);
    if (accessChanged) await prisma.user.update({ where: { id: user.id }, data: { passwordChangedAt: new Date() } });

    // Employee record in the home company, linked to the login (punch in, leave, payslips).
    let employee = m.employeeRecord === false ? null : await prisma.employee.findFirst({ where: { userId: user.id } });
    if (!employee && m.employeeRecord !== false) {
      const unlinked = await prisma.employee.findFirst({ where: { companyId: home.id, email, userId: null, deletedAt: null } });
      employee = unlinked
        ? await prisma.employee.update({ where: { id: unlinked.id }, data: { userId: user.id } })
        : await prisma.$transaction(async (tx) =>
            tx.employee.create({
              data: {
                companyId: home.id,
                code: await nextDocumentNumber(tx as unknown as Tx, home.id, "EMPLOYEE"),
                firstNameEn: m.en[0], lastNameEn: m.en[1], firstNameAr: m.ar[0], lastNameAr: m.ar[1],
                email, userId: user.id, branchId: mainBranch?.id ?? null, status: "ACTIVE",
              },
            }),
          );
    }

    rows.push({
      email, name: nameEn, access: m.access, employee: employee?.code ?? "none",
      password: password ?? saved.get(email) ?? "",
      status: !existing ? "created" : password ? "password reset" : accessChanged ? "access changed, signed out" : "updated",
    });
  }

  // Keep every known password in the file, so the next database gets the same ones.
  const known = new Map(saved);
  for (const r of rows) if (r.password) known.set(r.email, r.password);
  const lines = ["email,name,access,password"];
  for (const r of rows) if (known.has(r.email)) lines.push([r.email, r.name, r.access, known.get(r.email)].join(","));
  writeFileSync(passwordFile, lines.join("\n") + "\n", "utf8");

  if (lockDemo) {
    const staff = await prisma.user.updateMany({ where: { email: { in: DEMO_STAFF }, isActive: true }, data: { isActive: false, passwordChangedAt: new Date() } });
    const portal = await prisma.portalUser.updateMany({ where: { email: { in: DEMO_PORTAL }, isActive: true }, data: { isActive: false, passwordChangedAt: new Date() } });
    console.log(`[team] Demo logins switched off: ${staff.count} staff, ${portal.count} portal.`);
  }

  console.table(rows.map((r) => ({ email: r.email, access: r.access, employee: r.employee, status: r.status, password: r.status === "created" || r.status === "password reset" ? r.password : "(unchanged)" })));
  console.log(`[team] ${rows.length} accounts ready (home company: ${home.nameEn}). Passwords saved to ${passwordFile}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
