import { Prisma } from "@prisma/client";
import { prisma, type Tx } from "@/lib/prisma";

export const DOC_TYPES = [
  "JOURNAL", "INVOICE", "CREDIT_NOTE", "RECEIPT", "BILL", "PAYMENT", "QUOTATION", "SALES_ORDER",
  "PURCHASE_REQUEST", "RFQ", "PURCHASE_ORDER", "PETTY_CASH", "ASSET", "PAYROLL", "LEAVE", "LOAN",
  "CUSTOMER", "VENDOR", "ITEM", "EMPLOYEE", "CONTRACT", "VAT_RETURN", "LEAD", "OPPORTUNITY",
  "EMP_CONTRACT", "PAYSLIP", "EOSB",
] as const;
export type DocType = (typeof DOC_TYPES)[number];

export const DEFAULT_PREFIXES: Record<DocType, string> = {
  JOURNAL: "JV", INVOICE: "INV", CREDIT_NOTE: "CN", RECEIPT: "RCT", BILL: "BILL", PAYMENT: "PAY",
  QUOTATION: "QT", SALES_ORDER: "SO", PURCHASE_REQUEST: "PR", RFQ: "RFQ", PURCHASE_ORDER: "PO",
  PETTY_CASH: "PC", ASSET: "FA", PAYROLL: "PAYR", LEAVE: "LV", LOAN: "LN", CUSTOMER: "C", VENDOR: "V",
  ITEM: "ITM", EMPLOYEE: "EMP", CONTRACT: "CTR", VAT_RETURN: "VAT", LEAD: "LD", OPPORTUNITY: "OPP",
  EMP_CONTRACT: "EC", PAYSLIP: "PS", EOSB: "EOS",
};

function periodKeyFor(policy: "NEVER" | "YEARLY" | "MONTHLY", date: Date) {
  if (policy === "NEVER") return "";
  const y = date.getFullYear();
  if (policy === "YEARLY") return String(y);
  return `${y}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function renderPattern(pattern: string, prefix: string, seq: number, date: Date) {
  return pattern
    .replace("{PREFIX}", prefix)
    .replace("{YYYY}", String(date.getFullYear()))
    .replace("{YY}", String(date.getFullYear()).slice(-2))
    .replace("{MM}", String(date.getMonth() + 1).padStart(2, "0"))
    .replace(/\{SEQ(?::(\d+))?\}/, (_m, w) => String(seq).padStart(w ? Number(w) : 4, "0"));
}

/**
 * Allocates the next document number for a company/docType, gap-free and safe under
 * concurrency (row lock). Must be called inside the document's transaction.
 */
export async function nextDocumentNumber(tx: Tx, companyId: string, docType: DocType | string, date = new Date()): Promise<string> {
  // Find configuration row (periodKey "" or current) to learn prefix/pattern/policy.
  const config =
    (await tx.documentSequence.findFirst({ where: { companyId, docType }, orderBy: { updatedAt: "desc" } })) ?? null;
  const prefix = config?.prefix ?? DEFAULT_PREFIXES[docType as DocType] ?? docType.slice(0, 3);
  const pattern = config?.pattern ?? "{PREFIX}-{YYYY}-{SEQ:4}";
  const policy = config?.resetPolicy ?? "YEARLY";
  const periodKey = periodKeyFor(policy, date);

  // Lock or create the counter row for this period.
  const rows = await tx.$queryRaw<{ id: string; nextNumber: number }[]>(
    Prisma.sql`SELECT "id", "nextNumber" FROM "DocumentSequence" WHERE "companyId" = ${companyId} AND "docType" = ${docType} AND "periodKey" = ${periodKey} FOR UPDATE`,
  );
  let seq: number;
  if (rows.length === 0) {
    await tx.documentSequence.create({
      data: { companyId, docType, prefix, pattern, resetPolicy: policy, periodKey, nextNumber: 2 },
    });
    seq = 1;
  } else {
    seq = rows[0].nextNumber;
    await tx.documentSequence.update({ where: { id: rows[0].id }, data: { nextNumber: seq + 1 } });
  }
  return renderPattern(pattern, prefix, seq, date);
}

/** Convenience when not already in a transaction (master data codes). */
export async function allocateNumber(companyId: string, docType: DocType | string, date = new Date()) {
  return prisma.$transaction((tx) => nextDocumentNumber(tx, companyId, docType, date));
}
