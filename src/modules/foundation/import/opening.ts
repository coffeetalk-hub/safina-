import type { AppSession } from "@/core/auth/session";
import type { ImportDefinition } from "@/core/import";
import { runImport } from "@/core/import";

/**
 * Opening balances import. Rows are validated and collected; the actual balanced
 * journal is posted by the finance module's posting engine (wired in Module 2).
 * Until then, this validates and reports; `postOpening` is a hook finance registers.
 */
let postOpening: ((session: AppSession, lines: OpeningLine[]) => Promise<string>) | null = null;
export type OpeningLine = { accountId: string; costCenterId: string | null; debit: number; credit: number; description: string | null };

export function registerOpeningPoster(fn: typeof postOpening) {
  postOpening = fn;
}

export async function postOpeningBalances(session: AppSession, def: ImportDefinition, buf: Buffer, fileName: string) {
  const lines: OpeningLine[] = [];
  const wrapped: ImportDefinition = { ...def, prepare: async () => new Map<string, unknown>([["lines", lines]]) };
  const result = await runImport(wrapped, session, buf, fileName);
  if (result.failed > 0) return { ...result, posted: false, message: "Fix errors and re-upload; nothing was posted." };
  const debit = lines.reduce((a, l) => a + l.debit, 0);
  const credit = lines.reduce((a, l) => a + l.credit, 0);
  if (Math.abs(debit - credit) > 0.005) return { ...result, posted: false, message: `Not balanced: debit ${debit.toFixed(2)} ≠ credit ${credit.toFixed(2)}` };
  if (!postOpening) return { ...result, posted: false, message: "Validated. Posting engine (Finance module) not yet available." };
  const number = await postOpening(session, lines);
  return { ...result, posted: true, message: `Posted journal ${number}` };
}
