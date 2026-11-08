import { notFound } from "next/navigation";
import { financePage } from "@/modules/finance/_shared/page-helpers";
import { financeLookups } from "@/modules/finance/_shared/lookups";
import { getReceipt, openInvoices } from "@/modules/finance/ar/receipts";
import { deleteReceiptAction, openInvoicesAction, postReceiptAction, reverseReceiptAction, saveReceiptAction } from "@/modules/finance/ar/actions";
import { SettlementEditor, type SettlementData } from "@/components/finance/settlement-editor";
import { listForEntity } from "@/modules/foundation/attachments/service";
import { can } from "@/core/auth/session";
import { plain } from "@/components/data-table/types";

export default async function ReceiptPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ customerId?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const { session, locale, perms } = await financePage("receipt");
  const lk = await financeLookups(session.companyId, locale);
  const actions = { save: saveReceiptAction, post: postReceiptAction, reverse: reverseReceiptAction, remove: deleteReceiptAction, loadOpen: openInvoicesAction };
  const canAttach = { upload: can(session, "foundation.attachment:create"), delete: can(session, "foundation.attachment:delete") };
  const mapOpen = (rows: Awaited<ReturnType<typeof openInvoices>>) => plain(rows).map((r) => ({ id: r.id, number: r.number, date: r.invoiceDate, dueDate: r.dueDate, total: r.total, outstanding: r.outstanding, allocated: r.allocated }));
  if (id === "new") {
    const open = sp.customerId ? mapOpen(await openInvoices(session, sp.customerId)) : [];
    return <SettlementEditor mode="AR" doc={null} lookups={lk} can={perms} actions={actions} attachments={[]} canAttach={canAttach} pdfDoc="receipt" listHref="/finance/ar/receipts" initialOpen={open} initialParty={sp.customerId ?? null} />;
  }
  const r = await getReceipt(session, id);
  if (!r) notFound();
  const [attachments, open] = await Promise.all([listForEntity(session.companyId, "Receipt", id), r.status === "DRAFT" ? openInvoices(session, r.customerId, r.id) : Promise.resolve([])]);
  const p = plain(r);
  const doc: SettlementData = { id: p.id, number: p.number, partyId: p.customerId, branchId: p.branchId, date: p.receiptDate, method: p.method, bankAccountId: p.bankAccountId, currencyCode: p.currencyCode, exchangeRate: p.exchangeRate, amount: p.amount, reference: p.reference, notes: p.notes, status: p.status, journalEntryId: p.journalEntryId, allocations: p.allocations.map((a) => ({ docId: a.invoiceId, amount: a.amount })) };
  const initialOpen = r.status === "DRAFT" ? mapOpen(open) : p.allocations.map((a) => ({ id: a.invoice.id, number: a.invoice.number, date: a.invoice.invoiceDate, dueDate: a.invoice.dueDate, total: a.invoice.total, outstanding: a.amount, allocated: a.amount }));
  return <SettlementEditor mode="AR" doc={doc} lookups={lk} can={perms} actions={actions} attachments={plain(attachments)} canAttach={canAttach} pdfDoc="receipt" listHref="/finance/ar/receipts" initialOpen={initialOpen} />;
}
