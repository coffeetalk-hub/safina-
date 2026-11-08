import type React from "react";
import type { AppSession } from "@/core/auth/session";

/** Document PDF generators keyed by doc type (invoice, payslip, …). Modules register theirs. */
export type PdfGenerator = {
  /** Any one of these grants the document; the renderer still applies ownership. */
  permission: string | readonly string[];
  render: (session: AppSession, id: string, locale: string) => Promise<{ element: React.ReactElement; fileName: string } | null>;
};

const registry = new Map<string, () => Promise<PdfGenerator>>();
export function registerPdf(doc: string, loader: () => Promise<PdfGenerator>) {
  registry.set(doc, loader);
}
export async function getPdf(doc: string) {
  const l = registry.get(doc);
  return l ? l() : null;
}
