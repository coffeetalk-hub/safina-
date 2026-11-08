import { z } from "zod";
import { prisma } from "@/lib/prisma";
import type { AppSession } from "@/core/auth/session";
import { buildStorageKey, storage } from "@/core/attachments/storage";

export const settingsSchema = z.object({
  invoiceFooterAr: z.string().max(1000).default(""),
  invoiceFooterEn: z.string().max(1000).default(""),
  invoiceTermsAr: z.string().max(1000).default(""),
  invoiceTermsEn: z.string().max(1000).default(""),
  showQr: z.coerce.boolean().default(true),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#1e3a5f"),
  bankDetails: z.string().max(500).default(""),
  invoiceTemplate: z.enum(["CLASSIC", "MODERN"]).default("CLASSIC"),
  defaultPaymentTermsDays: z.coerce.number().int().min(0).max(365).default(30),
  emailNotifications: z.coerce.boolean().default(true),
});
export type CompanySettings = z.infer<typeof settingsSchema>;

export async function getSettings(companyId: string): Promise<CompanySettings> {
  const rows = await prisma.companySetting.findMany({ where: { companyId } });
  const obj = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return settingsSchema.parse(obj);
}

export async function saveSettings(session: AppSession, input: CompanySettings) {
  for (const [key, value] of Object.entries(input)) {
    await prisma.companySetting.upsert({ where: { companyId_key: { companyId: session.companyId, key } }, create: { companyId: session.companyId, key, value: value as string }, update: { value: value as string } });
  }
  return true;
}

export async function saveLogo(session: AppSession, file: File | null) {
  const company = await prisma.company.findUniqueOrThrow({ where: { id: session.companyId } });
  if (!file) {
    if (company.logoKey) await storage.remove(company.logoKey);
    await prisma.company.update({ where: { id: company.id }, data: { logoKey: null } });
    return true;
  }
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size > 2 * 1024 * 1024) throw new Error("INVALID_FILE");
  const key = buildStorageKey(session.companyId, "logo", file.name);
  await storage.put(key, Buffer.from(await file.arrayBuffer()), file.type);
  if (company.logoKey) await storage.remove(company.logoKey);
  await prisma.company.update({ where: { id: company.id }, data: { logoKey: key } });
  return true;
}

/** Company header data used by every PDF. */
export async function companyHeader(companyId: string) {
  const c = await prisma.company.findUniqueOrThrow({ where: { id: companyId } });
  const s = await getSettings(companyId);
  let logoDataUrl: string | null = null;
  if (c.logoKey) {
    try {
      const buf = await storage.get(c.logoKey);
      const mime = c.logoKey.endsWith(".png") ? "image/png" : c.logoKey.endsWith(".webp") ? "image/webp" : "image/jpeg";
      logoDataUrl = `data:${mime};base64,${buf.toString("base64")}`;
    } catch {
      logoDataUrl = null;
    }
  }
  return { company: c, settings: s, logoDataUrl };
}
