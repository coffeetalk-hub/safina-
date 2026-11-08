import type { Tx } from "@/lib/prisma";

type Hook = (tx: Tx, req: { docType: string; docId: string }) => Promise<void>;

const onApproved = new Map<string, Hook>();
const onRejected = new Map<string, Hook>();

/**
 * Modules register what happens to their document when the approval request is
 * finally approved or rejected (e.g. set invoice status to APPROVED and post GL).
 */
export function registerApprovalHooks(docType: string, hooks: { onApproved?: Hook; onRejected?: Hook }) {
  if (hooks.onApproved) onApproved.set(docType, hooks.onApproved);
  if (hooks.onRejected) onRejected.set(docType, hooks.onRejected);
}

export function runApprovalHooks() {
  return {
    onApproved: async (tx: Tx, req: { docType: string; docId: string }) => {
      await onApproved.get(req.docType)?.(tx, req);
    },
    onRejected: async (tx: Tx, req: { docType: string; docId: string }) => {
      await onRejected.get(req.docType)?.(tx, req);
    },
  };
}

/** Where to navigate for a given docType/docId (modules extend this). */
export const DOC_LINKS: Record<string, (id: string) => string> = {};
export function docLink(docType: string, docId: string) {
  return DOC_LINKS[docType]?.(docId) ?? "#";
}
