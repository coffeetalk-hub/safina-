import { Prisma, type JournalSource } from "@prisma/client";
import { prisma, type Tx } from "@/lib/prisma";
import { D, round, ZERO } from "@/lib/money";
import { nextDocumentNumber } from "@/core/numbering";

/**
 * Posting engine — the ONLY way journal lines are created.
 * Documents (invoices, bills, receipts, payments, petty cash, depreciation, payroll…)
 * describe their accounting effect as PostingLines; this module validates, balances,
 * numbers and writes the JournalEntry inside the caller's transaction.
 */

export type PostingLine = {
  accountId: string;
  costCenterId?: string | null;
  description?: string | null;
  /** amounts in the document currency */
  debit?: Prisma.Decimal.Value;
  credit?: Prisma.Decimal.Value;
  partyType?: "CUSTOMER" | "VENDOR" | "EMPLOYEE" | null;
  partyId?: string | null;
  taxCodeId?: string | null;
  taxBase?: Prisma.Decimal.Value | null;
};

export type PostJournalInput = {
  companyId: string;
  branchId?: string | null;
  entryDate: Date;
  description?: string | null;
  reference?: string | null;
  source: JournalSource;
  sourceType?: string | null;
  sourceId?: string | null;
  currencyCode?: string;
  exchangeRate?: Prisma.Decimal.Value;
  lines: PostingLine[];
  userId: string;
  /** Existing draft entry to post in place (manual journals) */
  entryId?: string;
  number?: string;
  recurringId?: string | null;
};

export class PostingError extends Error {
  constructor(code: string, public detail?: string) {
    super(detail ? `${code}: ${detail}` : code);
    this.name = "PostingError";
  }
}

/** Resolves a control-account mapping key to an account id. */
export async function mappedAccount(db: Tx | typeof prisma, companyId: string, key: string): Promise<string> {
  const m = await db.accountMapping.findUnique({ where: { companyId_key: { companyId, key } } });
  if (!m) throw new PostingError("MAPPING_MISSING", key);
  return m.accountId;
}

export async function findOpenPeriod(db: Tx | typeof prisma, companyId: string, date: Date) {
  const period = await db.fiscalPeriod.findFirst({ where: { companyId, startDate: { lte: date }, endDate: { gte: date } } });
  if (!period) throw new PostingError("NO_FISCAL_PERIOD", date.toISOString().slice(0, 10));
  if (period.status !== "OPEN") throw new PostingError("PERIOD_CLOSED", period.name);
  return period;
}

/** Validates lines and returns normalised lines with base amounts. Adds a rounding line if needed. */
export async function prepareLines(db: Tx | typeof prisma, companyId: string, lines: PostingLine[], rate: Prisma.Decimal) {
  const cleaned = lines
    .map((l) => ({ ...l, debit: round(l.debit ?? 0, 4), credit: round(l.credit ?? 0, 4) }))
    .filter((l) => !l.debit.isZero() || !l.credit.isZero());
  if (cleaned.length < 2) throw new PostingError("TOO_FEW_LINES");
  for (const l of cleaned) {
    if (l.debit.lt(0) || l.credit.lt(0)) throw new PostingError("NEGATIVE_AMOUNT");
    if (!l.debit.isZero() && !l.credit.isZero()) throw new PostingError("DEBIT_AND_CREDIT");
  }
  const ids = [...new Set(cleaned.map((l) => l.accountId))];
  const accounts = await db.account.findMany({ where: { id: { in: ids }, companyId } });
  for (const id of ids) {
    const a = accounts.find((x) => x.id === id);
    if (!a) throw new PostingError("ACCOUNT_NOT_FOUND", id);
    if (!a.isPostable || !a.isActive) throw new PostingError("ACCOUNT_NOT_POSTABLE", a.code);
  }
  const ccIds = [...new Set(cleaned.map((l) => l.costCenterId).filter(Boolean))] as string[];
  if (ccIds.length) {
    const n = await db.costCenter.count({ where: { id: { in: ccIds }, companyId } });
    if (n !== ccIds.length) throw new PostingError("COST_CENTER_NOT_FOUND");
  }
  const withBase = cleaned.map((l) => ({ ...l, baseDebit: round(l.debit.times(rate), 2), baseCredit: round(l.credit.times(rate), 2) }));
  const totalDebit = withBase.reduce((a, l) => a.plus(l.debit), ZERO);
  const totalCredit = withBase.reduce((a, l) => a.plus(l.credit), ZERO);
  if (!round(totalDebit, 2).eq(round(totalCredit, 2))) throw new PostingError("UNBALANCED", `${totalDebit} ≠ ${totalCredit}`);
  // base-currency rounding difference
  const baseDiff = withBase.reduce((a, l) => a.plus(l.baseDebit).minus(l.baseCredit), ZERO);
  if (!baseDiff.isZero()) {
    if (baseDiff.abs().gt(1)) throw new PostingError("UNBALANCED_BASE", baseDiff.toString());
    const roundingAcc = await mappedAccount(db, companyId, "ROUNDING");
    withBase.push({ accountId: roundingAcc, description: "Rounding", debit: ZERO, credit: ZERO, baseDebit: baseDiff.lt(0) ? baseDiff.abs() : ZERO, baseCredit: baseDiff.gt(0) ? baseDiff : ZERO });
  }
  return { lines: withBase, totalDebit, totalCredit };
}

/** Creates and posts a journal entry. Returns the entry with lines. */
export async function postJournal(tx: Tx, input: PostJournalInput) {
  const rate = D(input.exchangeRate ?? 1);
  const period = await findOpenPeriod(tx, input.companyId, input.entryDate);
  const { lines, totalDebit, totalCredit } = await prepareLines(tx, input.companyId, input.lines, rate);
  const number = input.number ?? (await nextDocumentNumber(tx, input.companyId, "JOURNAL", input.entryDate));
  const data = {
    companyId: input.companyId,
    branchId: input.branchId ?? null,
    periodId: period.id,
    number,
    entryDate: input.entryDate,
    description: input.description ?? null,
    reference: input.reference ?? null,
    status: "POSTED" as const,
    source: input.source,
    sourceType: input.sourceType ?? null,
    sourceId: input.sourceId ?? null,
    currencyCode: input.currencyCode ?? "SAR",
    exchangeRate: rate,
    totalDebit,
    totalCredit,
    postedAt: new Date(),
    postedById: input.userId,
    recurringId: input.recurringId ?? null,
  };
  const lineData = lines.map((l, i) => ({
    companyId: input.companyId,
    lineNo: i + 1,
    accountId: l.accountId,
    costCenterId: l.costCenterId ?? null,
    description: l.description ?? null,
    debit: l.debit,
    credit: l.credit,
    baseDebit: l.baseDebit,
    baseCredit: l.baseCredit,
    partyType: l.partyType ?? null,
    partyId: l.partyId ?? null,
    taxCodeId: l.taxCodeId ?? null,
    taxBase: l.taxBase == null ? null : round(l.taxBase, 4),
  }));
  if (input.entryId) {
    const existing = await tx.journalEntry.findFirst({ where: { id: input.entryId, companyId: input.companyId } });
    if (!existing) throw new PostingError("NOT_FOUND");
    if (existing.status === "POSTED" || existing.status === "REVERSED") throw new PostingError("ALREADY_POSTED");
    await tx.journalLine.deleteMany({ where: { entryId: input.entryId } });
    const entry = await tx.journalEntry.update({ where: { id: input.entryId }, data: { ...data, number: existing.number, updatedById: input.userId, lines: { create: lineData } }, include: { lines: true } });
    await audit(tx, input, entry.id, "POST");
    return entry;
  }
  const entry = await tx.journalEntry.create({ data: { ...data, createdById: input.userId, lines: { create: lineData } }, include: { lines: true } });
  await audit(tx, input, entry.id, "POST");
  return entry;
}

/** Reverses a posted entry on `date` (defaults to today). Original gets status REVERSED. */
export async function reverseJournal(tx: Tx, companyId: string, entryId: string, userId: string, date = new Date(), description?: string) {
  const original = await tx.journalEntry.findFirst({ where: { id: entryId, companyId }, include: { lines: true } });
  if (!original) throw new PostingError("NOT_FOUND");
  if (original.status !== "POSTED") throw new PostingError("NOT_POSTED");
  const period = await findOpenPeriod(tx, companyId, date);
  const number = await nextDocumentNumber(tx, companyId, "JOURNAL", date);
  const reversal = await tx.journalEntry.create({
    data: {
      companyId,
      branchId: original.branchId,
      periodId: period.id,
      number,
      entryDate: date,
      description: description ?? `Reversal of ${original.number}`,
      reference: original.number,
      status: "POSTED",
      source: original.source,
      sourceType: original.sourceType,
      sourceId: original.sourceId,
      currencyCode: original.currencyCode,
      exchangeRate: original.exchangeRate,
      totalDebit: original.totalCredit,
      totalCredit: original.totalDebit,
      reversalOfId: original.id,
      postedAt: new Date(),
      postedById: userId,
      createdById: userId,
      lines: {
        create: original.lines.map((l) => ({
          companyId,
          lineNo: l.lineNo,
          accountId: l.accountId,
          costCenterId: l.costCenterId,
          description: l.description,
          debit: l.credit,
          credit: l.debit,
          baseDebit: l.baseCredit,
          baseCredit: l.baseDebit,
          partyType: l.partyType,
          partyId: l.partyId,
          taxCodeId: l.taxCodeId,
          taxBase: l.taxBase ? l.taxBase.neg() : null,
        })),
      },
    },
  });
  await tx.journalEntry.update({ where: { id: original.id }, data: { status: "REVERSED", updatedById: userId } });
  await tx.auditLog.create({ data: { companyId, userId, entity: "JournalEntry", entityId: original.id, action: "REVERSE", after: { reversalId: reversal.id, number } } });
  return reversal;
}

async function audit(tx: Tx, input: PostJournalInput, entryId: string, action: "POST") {
  await tx.auditLog.create({ data: { companyId: input.companyId, userId: input.userId, entity: "JournalEntry", entityId: entryId, action, after: { source: input.source, sourceType: input.sourceType ?? null, sourceId: input.sourceId ?? null } } });
}

/** Sum of posted base debit-credit for an account (optionally filtered). Positive = net debit. */
export async function accountNetBalance(companyId: string, accountId: string, opts: { to?: Date; from?: Date; costCenterId?: string; branchId?: string } = {}) {
  const r = await prisma.journalLine.aggregate({
    where: {
      companyId,
      accountId,
      costCenterId: opts.costCenterId,
      entry: { status: "POSTED", branchId: opts.branchId, entryDate: { gte: opts.from, lte: opts.to } },
    },
    _sum: { baseDebit: true, baseCredit: true },
  });
  return D(r._sum.baseDebit ?? 0).minus(D(r._sum.baseCredit ?? 0));
}
