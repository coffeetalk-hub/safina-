import { z } from "zod";
import { prisma } from "@/lib/prisma";
import type { AppSession } from "@/core/auth/session";
import { orderByFrom, skipTake, type ColumnDef, type ListParams, type PagedResult } from "@/components/data-table/types";
import { postJournal, reverseJournal, prepareLines, findOpenPeriod } from "@/core/posting";
import { nextDocumentNumber } from "@/core/numbering";
import { D, round, ZERO } from "@/lib/money";
import { submitForApproval } from "@/core/approvals/engine";
import { getRate } from "@/modules/foundation/currencies/service";

export const journalLineSchema = z.object({
  accountId: z.string().min(1),
  costCenterId: z.string().nullable().optional(),
  description: z.string().max(500).nullable().optional(),
  debit: z.coerce.number().min(0).default(0),
  credit: z.coerce.number().min(0).default(0),
});

export const journalSchema = z.object({
  id: z.string().nullable().optional(),
  entryDate: z.string().min(10),
  branchId: z.string().nullable().optional(),
  description: z.string().max(500).nullable().optional(),
  reference: z.string().max(100).nullable().optional(),
  currencyCode: z.string().length(3).default("SAR"),
  exchangeRate: z.coerce.number().positive().default(1),
  lines: z.array(journalLineSchema).min(2),
});
export type JournalInput = z.infer<typeof journalSchema>;

const include = { lines: { orderBy: { lineNo: "asc" as const }, include: { account: { select: { code: true, nameAr: true, nameEn: true } }, costCenter: { select: { code: true } } } }, period: { select: { name: true } }, branch: { select: { code: true, nameAr: true, nameEn: true } } };

function where(session: AppSession, p: ListParams) {
  const w: Record<string, unknown> = { companyId: session.companyId };
  if (p.q) w.OR = [{ number: { contains: p.q, mode: "insensitive" } }, { description: { contains: p.q, mode: "insensitive" } }, { reference: { contains: p.q, mode: "insensitive" } }];
  if (p.filters.status) w.status = p.filters.status;
  if (p.filters.source) w.source = p.filters.source;
  if (p.filters.branchId) w.branchId = p.filters.branchId;
  if (p.filters.from || p.filters.to) w.entryDate = { gte: p.filters.from ? new Date(p.filters.from) : undefined, lte: p.filters.to ? new Date(p.filters.to) : undefined };
  return w;
}

export async function listJournals(session: AppSession, p: ListParams): Promise<PagedResult<Record<string, unknown>>> {
  const w = where(session, p);
  const [rows, total] = await Promise.all([
    prisma.journalEntry.findMany({ where: w, orderBy: orderByFrom(p.sort, ["number", "entryDate", "status", "totalDebit", "source"], { entryDate: "desc" }), ...skipTake(p), include: { branch: { select: { code: true } }, period: { select: { name: true } } } }),
    prisma.journalEntry.count({ where: w }),
  ]);
  return { rows, total, page: p.page, pageSize: p.pageSize };
}
export async function allJournals(session: AppSession, p: ListParams) {
  return prisma.journalEntry.findMany({ where: where(session, p), orderBy: { entryDate: "desc" }, take: 10_000, include: { branch: { select: { code: true } }, period: { select: { name: true } } } });
}

export async function getJournal(session: AppSession, id: string) {
  return prisma.journalEntry.findFirst({ where: { id, companyId: session.companyId }, include });
}

/** Save as draft (validates structure & balance, but does not post). */
export async function saveJournalDraft(session: AppSession, input: JournalInput) {
  const entryDate = new Date(input.entryDate);
  const rate = input.currencyCode === "SAR" ? 1 : input.exchangeRate;
  return prisma.$transaction(async (tx) => {
    const period = await findOpenPeriod(tx, session.companyId, entryDate);
    const { lines, totalDebit, totalCredit } = await prepareLines(tx, session.companyId, input.lines, D(rate));
    const lineData = lines.map((l, i) => ({ companyId: session.companyId, lineNo: i + 1, accountId: l.accountId, costCenterId: l.costCenterId ?? null, description: l.description ?? null, debit: l.debit, credit: l.credit, baseDebit: l.baseDebit, baseCredit: l.baseCredit }));
    const base = { branchId: input.branchId || null, periodId: period.id, entryDate, description: input.description ?? null, reference: input.reference ?? null, currencyCode: input.currencyCode, exchangeRate: rate, totalDebit, totalCredit };
    if (input.id) {
      const existing = await tx.journalEntry.findFirst({ where: { id: input.id, companyId: session.companyId } });
      if (!existing) throw new Error("NOT_FOUND");
      if (existing.status !== "DRAFT") throw new Error("NOT_DRAFT");
      await tx.journalLine.deleteMany({ where: { entryId: input.id } });
      return tx.journalEntry.update({ where: { id: input.id }, data: { ...base, updatedById: session.userId, lines: { create: lineData } } });
    }
    const number = await nextDocumentNumber(tx, session.companyId, "JOURNAL", entryDate);
    return tx.journalEntry.create({ data: { ...base, companyId: session.companyId, number, status: "DRAFT", source: "MANUAL", createdById: session.userId, lines: { create: lineData } } });
  });
}

/** Posts a draft; if an approval policy applies, submits for approval instead. */
export async function postJournalEntry(session: AppSession, id: string) {
  return prisma.$transaction(async (tx) => {
    const entry = await tx.journalEntry.findFirst({ where: { id, companyId: session.companyId }, include: { lines: true } });
    if (!entry) throw new Error("NOT_FOUND");
    if (entry.status !== "DRAFT" && entry.status !== "APPROVED") throw new Error("NOT_DRAFT");
    if (entry.status === "DRAFT") {
      const req = await submitForApproval(tx, { companyId: session.companyId, docType: "JOURNAL", docId: entry.id, docNumber: entry.number, amount: entry.totalDebit, requestedById: session.userId, link: `/finance/journals/${entry.id}` });
      if (req) {
        await tx.journalEntry.update({ where: { id }, data: { status: "PENDING_APPROVAL" } });
        return { status: "PENDING_APPROVAL" as const };
      }
    }
    await postJournal(tx, {
      companyId: session.companyId,
      branchId: entry.branchId,
      entryDate: entry.entryDate,
      description: entry.description,
      reference: entry.reference,
      source: entry.source as "MANUAL",
      currencyCode: entry.currencyCode,
      exchangeRate: entry.exchangeRate,
      lines: entry.lines.map((l) => ({ accountId: l.accountId, costCenterId: l.costCenterId, description: l.description, debit: l.debit, credit: l.credit })),
      userId: session.userId,
      entryId: entry.id,
      number: entry.number,
    });
    return { status: "POSTED" as const };
  });
}

export async function reverseJournalEntry(session: AppSession, id: string, date?: string) {
  return prisma.$transaction((tx) => reverseJournal(tx, session.companyId, id, session.userId, date ? new Date(date) : new Date()));
}

export async function deleteJournalDraft(session: AppSession, id: string) {
  const entry = await prisma.journalEntry.findFirst({ where: { id, companyId: session.companyId } });
  if (!entry) throw new Error("NOT_FOUND");
  if (entry.status !== "DRAFT") throw new Error("NOT_DRAFT");
  return prisma.journalEntry.delete({ where: { id } });
}

export function journalColumns(tf: (k: string) => string, t: (k: string) => string): ColumnDef[] {
  return [
    { key: "number", label: tf("number"), sortable: true, type: "link", hrefTemplate: "/finance/journals/{id}" },
    { key: "entryDate", label: tf("date"), type: "date", sortable: true },
    { key: "description", label: tf("description") },
    { key: "reference", label: t("reference"), hidden: true },
    { key: "source", label: t("source"), type: "enum", enumName: "JournalSource" },
    { key: "period", label: tf("period"), path: "period.name" },
    { key: "branch", label: tf("branch"), path: "branch.code", hidden: true },
    { key: "totalDebit", label: t("debit"), type: "money", align: "end", sortable: true, currencyPath: "currencyCode" },
    { key: "status", label: tf("status"), type: "enum", enumName: "DocStatus", tones: { DRAFT: "secondary", PENDING_APPROVAL: "warning", APPROVED: "info", POSTED: "success", REVERSED: "destructive" } },
  ];
}

// ── Recurring journals

export const recurringSchema = z.object({
  id: z.string().nullable().optional(),
  nameAr: z.string().min(1).max(120),
  nameEn: z.string().min(1).max(120),
  description: z.string().max(500).nullable().optional(),
  frequency: z.enum(["WEEKLY", "MONTHLY", "QUARTERLY", "YEARLY"]).default("MONTHLY"),
  startDate: z.string().min(10),
  endDate: z.string().nullable().optional(),
  autoPost: z.coerce.boolean().default(false),
  isActive: z.coerce.boolean().default(true),
  lines: z.array(journalLineSchema).min(2),
});

export async function listRecurring(session: AppSession) {
  return prisma.recurringJournal.findMany({ where: { companyId: session.companyId }, orderBy: { nextRunDate: "asc" }, include: { _count: { select: { entries: true } } } });
}

export async function saveRecurring(session: AppSession, input: z.infer<typeof recurringSchema>) {
  const { id, lines, ...rest } = input;
  const debit = lines.reduce((a, l) => a + l.debit, 0);
  const credit = lines.reduce((a, l) => a + l.credit, 0);
  if (Math.abs(debit - credit) > 0.005) throw new Error("UNBALANCED");
  const data = { ...rest, endDate: rest.endDate ? new Date(rest.endDate) : null, startDate: new Date(rest.startDate), lines };
  if (id) {
    const ex = await prisma.recurringJournal.findFirst({ where: { id, companyId: session.companyId } });
    if (!ex) throw new Error("NOT_FOUND");
    return prisma.recurringJournal.update({ where: { id }, data: { ...data, nextRunDate: ex.lastRunDate ? ex.nextRunDate : new Date(rest.startDate) } });
  }
  return prisma.recurringJournal.create({ data: { ...data, companyId: session.companyId, nextRunDate: new Date(rest.startDate), createdById: session.userId } });
}

export function advance(date: Date, f: "WEEKLY" | "MONTHLY" | "QUARTERLY" | "YEARLY") {
  const d = new Date(date);
  if (f === "WEEKLY") d.setUTCDate(d.getUTCDate() + 7);
  else if (f === "MONTHLY") d.setUTCMonth(d.getUTCMonth() + 1);
  else if (f === "QUARTERLY") d.setUTCMonth(d.getUTCMonth() + 3);
  else d.setUTCFullYear(d.getUTCFullYear() + 1);
  return d;
}

/** Generates due recurring entries (as drafts or posted). Returns count. Used by cron + "Run now". */
export async function runRecurring(companyId: string | null, userId: string | null, upTo = new Date()) {
  const due = await prisma.recurringJournal.findMany({ where: { isActive: true, nextRunDate: { lte: upTo }, ...(companyId ? { companyId } : {}), OR: [{ endDate: null }, { endDate: { gte: upTo } }] } });
  let created = 0;
  for (const r of due) {
    let next = r.nextRunDate;
    while (next <= upTo && (!r.endDate || next <= r.endDate)) {
      const runDate = next;
      await prisma.$transaction(async (tx) => {
        const lines = (r.lines as { accountId: string; costCenterId?: string | null; description?: string | null; debit: number; credit: number }[]).map((l) => ({ ...l }));
        if (r.autoPost) {
          await postJournal(tx, { companyId: r.companyId, entryDate: runDate, description: r.description ?? r.nameEn, reference: r.nameEn, source: "RECURRING", recurringId: r.id, lines, userId: userId ?? r.createdById ?? "system" });
        } else {
          const period = await findOpenPeriod(tx, r.companyId, runDate);
          const { lines: prepared, totalDebit, totalCredit } = await prepareLines(tx, r.companyId, lines, D(1));
          const number = await nextDocumentNumber(tx, r.companyId, "JOURNAL", runDate);
          await tx.journalEntry.create({ data: { companyId: r.companyId, periodId: period.id, number, entryDate: runDate, description: r.description ?? r.nameEn, reference: r.nameEn, status: "DRAFT", source: "RECURRING", recurringId: r.id, totalDebit, totalCredit, createdById: userId, lines: { create: prepared.map((l, i) => ({ companyId: r.companyId, lineNo: i + 1, accountId: l.accountId, costCenterId: l.costCenterId ?? null, description: l.description ?? null, debit: l.debit, credit: l.credit, baseDebit: l.baseDebit, baseCredit: l.baseCredit })) } } });
        }
        next = advance(runDate, r.frequency);
        await tx.recurringJournal.update({ where: { id: r.id }, data: { lastRunDate: runDate, nextRunDate: next } });
      });
      created++;
    }
  }
  return created;
}

/** Posts opening balances as a single OPENING journal on the first day of the current fiscal year. */
export async function postOpeningBalancesJournal(session: AppSession, lines: { accountId: string; costCenterId: string | null; debit: number; credit: number; description: string | null }[]) {
  const fy = await prisma.fiscalYear.findFirst({ where: { companyId: session.companyId, status: "OPEN" }, orderBy: { startDate: "desc" } });
  if (!fy) throw new Error("NO_FISCAL_PERIOD");
  const entry = await prisma.$transaction((tx) => postJournal(tx, { companyId: session.companyId, entryDate: fy.startDate, description: "Opening balances", source: "OPENING", lines, userId: session.userId }));
  return entry.number;
}

export { D, round, ZERO, getRate };
