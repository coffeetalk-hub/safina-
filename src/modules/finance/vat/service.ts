import { prisma } from "@/lib/prisma";
import type { AppSession } from "@/core/auth/session";
import { D, ZERO } from "@/lib/money";
import { nextDocumentNumber } from "@/core/numbering";
import { postJournal, mappedAccount } from "@/core/posting";

export type VatBox = { key: string; amount: number; vat: number };

/**
 * VAT return in the ZATCA layout. Figures come from posted journal lines carrying
 * taxCodeId/taxBase (invoices, bills, petty cash) plus VAT control accounts for adjustments.
 */
export async function computeVatReturn(session: AppSession, from: Date, to: Date) {
  const taxCodes = await prisma.taxCode.findMany({ where: { companyId: session.companyId } });
  const cat = (id: string | null) => taxCodes.find((t) => t.id === id)?.category ?? "STANDARD";
  const lines = await prisma.journalLine.findMany({
    where: { companyId: session.companyId, taxCodeId: { not: null }, entry: { status: "POSTED", entryDate: { gte: from, lte: to } } },
    include: { entry: { select: { source: true } }, account: { select: { id: true } } },
  });
  const vatOut = await mappedAccount(prisma, session.companyId, "VAT_OUTPUT").catch(() => null);
  const vatIn = await mappedAccount(prisma, session.companyId, "VAT_INPUT").catch(() => null);
  const boxes: Record<string, { amount: ReturnType<typeof D>; vat: ReturnType<typeof D> }> = {
    salesStandard: { amount: ZERO, vat: ZERO }, salesZero: { amount: ZERO, vat: ZERO }, salesExempt: { amount: ZERO, vat: ZERO },
    purchasesStandard: { amount: ZERO, vat: ZERO }, purchasesZero: { amount: ZERO, vat: ZERO }, purchasesExempt: { amount: ZERO, vat: ZERO },
  };
  for (const l of lines) {
    const isSales = l.entry.source === "AR_INVOICE";
    const isPurchase = ["AP_BILL", "PETTY_CASH", "MANUAL", "RECURRING"].includes(l.entry.source) || l.accountId === vatIn;
    const c = cat(l.taxCodeId);
    const base = D(l.taxBase ?? 0);
    const vat = l.accountId === vatOut ? D(l.baseCredit).minus(l.baseDebit) : l.accountId === vatIn ? D(l.baseDebit).minus(l.baseCredit) : ZERO;
    const signedBase = isSales ? (D(l.baseCredit).gt(0) || l.accountId === vatOut ? base : base.neg()) : base;
    if (isSales || l.accountId === vatOut) {
      const k = c === "ZERO_RATED" ? "salesZero" : c === "EXEMPT" ? "salesExempt" : c === "OUT_OF_SCOPE" ? null : "salesStandard";
      if (k) { if (l.accountId === vatOut) boxes[k].vat = boxes[k].vat.plus(vat); else boxes[k].amount = boxes[k].amount.plus(signedBase); }
      if (l.accountId === vatOut && k) boxes[k].amount = boxes[k].amount.plus(base.times(D(l.baseCredit).gt(0) ? 1 : -1));
    } else if (isPurchase) {
      const k = c === "ZERO_RATED" ? "purchasesZero" : c === "EXEMPT" ? "purchasesExempt" : c === "OUT_OF_SCOPE" ? null : "purchasesStandard";
      if (k) { if (l.accountId === vatIn) { boxes[k].vat = boxes[k].vat.plus(vat); boxes[k].amount = boxes[k].amount.plus(base.times(D(l.baseDebit).gt(0) ? 1 : -1)); } else boxes[k].amount = boxes[k].amount.plus(base); }
    }
  }
  // Lines without VAT (zero/exempt) were counted on the revenue/expense line; standard lines counted on the VAT line only — avoid double count:
  // we only add `amount` on VAT-account lines for STANDARD; for zero/exempt we add from the base line. Done above.
  const outputVat = boxes.salesStandard.vat;
  const inputVat = boxes.purchasesStandard.vat;
  const rows: VatBox[] = Object.entries(boxes).map(([key, v]) => ({ key, amount: v.amount.toNumber(), vat: v.vat.toNumber() }));
  return { rows, outputVat: outputVat.toNumber(), inputVat: inputVat.toNumber(), netVat: outputVat.minus(inputVat).toNumber(), from, to };
}

export async function listVatReturns(session: AppSession) {
  return prisma.vatReturn.findMany({ where: { companyId: session.companyId }, orderBy: { periodStart: "desc" } });
}

export async function saveVatReturn(session: AppSession, from: Date, to: Date) {
  const r = await computeVatReturn(session, from, to);
  return prisma.$transaction(async (tx) => {
    const number = await nextDocumentNumber(tx, session.companyId, "VAT_RETURN", to);
    return tx.vatReturn.create({ data: { companyId: session.companyId, number, periodStart: from, periodEnd: to, outputVat: r.outputVat, inputVat: r.inputVat, netVat: r.netVat, data: r.rows, createdById: session.userId } });
  });
}

/** Marks as filed and posts the settlement entry: clears output/input VAT into VAT payable. */
export async function fileVatReturn(session: AppSession, id: string) {
  return prisma.$transaction(async (tx) => {
    const r = await tx.vatReturn.findFirst({ where: { id, companyId: session.companyId } });
    if (!r) throw new Error("NOT_FOUND");
    if (r.status === "FILED") throw new Error("ALREADY_FILED");
    const vatOut = await mappedAccount(tx, session.companyId, "VAT_OUTPUT");
    const vatIn = await mappedAccount(tx, session.companyId, "VAT_INPUT");
    const payable = await mappedAccount(tx, session.companyId, "VAT_PAYABLE");
    const out = D(r.outputVat);
    const inp = D(r.inputVat);
    const net = out.minus(inp);
    const lines = [] as { accountId: string; debit?: ReturnType<typeof D>; credit?: ReturnType<typeof D>; description: string }[];
    if (out.gt(0)) lines.push({ accountId: vatOut, debit: out, description: `VAT return ${r.number} output` });
    if (inp.gt(0)) lines.push({ accountId: vatIn, credit: inp, description: `VAT return ${r.number} input` });
    if (net.gt(0)) lines.push({ accountId: payable, credit: net, description: `VAT payable ${r.number}` });
    if (net.lt(0)) lines.push({ accountId: payable, debit: net.abs(), description: `VAT refundable ${r.number}` });
    let entryId: string | null = null;
    if (lines.length >= 2) {
      const e = await postJournal(tx, { companyId: session.companyId, entryDate: r.periodEnd, description: `VAT return ${r.number}`, reference: r.number, source: "MANUAL", sourceType: "VatReturn", sourceId: r.id, lines, userId: session.userId });
      entryId = e.id;
    }
    return tx.vatReturn.update({ where: { id }, data: { status: "FILED", filedAt: new Date(), journalEntryId: entryId } });
  });
}
