import { z } from "zod";
import { prisma } from "@/lib/prisma";
import type { AppSession } from "@/core/auth/session";
import { DOC_TYPES, DEFAULT_PREFIXES, renderPattern } from "@/core/numbering";

export const sequenceSchema = z.object({
  docType: z.enum(DOC_TYPES),
  prefix: z.string().trim().min(1).max(10).toUpperCase(),
  pattern: z.string().trim().min(5).max(60).refine((p) => p.includes("{SEQ"), "pattern must contain {SEQ}"),
  resetPolicy: z.enum(["NEVER", "YEARLY", "MONTHLY"]),
  nextNumber: z.coerce.number().int().min(1),
});

export async function listSequences(session: AppSession) {
  const rows = await prisma.documentSequence.findMany({ where: { companyId: session.companyId }, orderBy: [{ docType: "asc" }, { periodKey: "desc" }] });
  const now = new Date();
  return DOC_TYPES.map((docType) => {
    const current = rows.find((r) => r.docType === docType);
    const prefix = current?.prefix ?? DEFAULT_PREFIXES[docType];
    const pattern = current?.pattern ?? "{PREFIX}-{YYYY}-{SEQ:4}";
    const resetPolicy = current?.resetPolicy ?? "YEARLY";
    const nextNumber = current?.nextNumber ?? 1;
    return { id: docType, docType, prefix, pattern, resetPolicy, nextNumber, preview: renderPattern(pattern, prefix, nextNumber, now), configured: !!current };
  });
}

export async function saveSequence(session: AppSession, input: z.infer<typeof sequenceSchema>) {
  const periodKey = input.resetPolicy === "NEVER" ? "" : input.resetPolicy === "YEARLY" ? String(new Date().getFullYear()) : `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
  // Update all existing rows' config, and upsert the current period row with the next number.
  await prisma.documentSequence.updateMany({ where: { companyId: session.companyId, docType: input.docType }, data: { prefix: input.prefix, pattern: input.pattern, resetPolicy: input.resetPolicy } });
  return prisma.documentSequence.upsert({
    where: { companyId_docType_periodKey: { companyId: session.companyId, docType: input.docType, periodKey } },
    create: { companyId: session.companyId, docType: input.docType, periodKey, prefix: input.prefix, pattern: input.pattern, resetPolicy: input.resetPolicy, nextNumber: input.nextNumber },
    update: { nextNumber: input.nextNumber },
  });
}
