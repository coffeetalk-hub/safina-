import { notFound } from "next/navigation";
import { financePage } from "@/modules/finance/_shared/page-helpers";
import { financeLookups } from "@/modules/finance/_shared/lookups";
import { getInvoice } from "@/modules/finance/ar/invoices";
import { cancelInvoiceAction, creditNoteAction, postInvoiceAction, reverseInvoiceAction, saveInvoiceAction, submitZatcaAction } from "@/modules/finance/ar/actions";
import { DocEditor, type DocData } from "@/components/finance/doc-editor";
import { listForEntity } from "@/modules/foundation/attachments/service";
import { can } from "@/core/auth/session";
import { plain } from "@/components/data-table/types";
import { prisma } from "@/lib/prisma";

export default async function InvoicePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ customerId?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const { session, locale, perms } = await financePage("invoice");
  const lk = await financeLookups(session.companyId, locale);
  const actions = { save: saveInvoiceAction, post: postInvoiceAction, cancel: cancelInvoiceAction, reverse: reverseInvoiceAction, creditNote: creditNoteAction, submitZatca: submitZatcaAction };
  const canAttach = { upload: can(session, "foundation.attachment:create"), delete: can(session, "foundation.attachment:delete") };
  if (id === "new") return <DocEditor mode="AR" doc={null} lookups={lk} can={perms} actions={actions} attachments={[]} canAttach={canAttach} pdfDoc="invoice" listHref="/finance/ar/invoices" initialParty={sp.customerId ?? null} />;
  const inv = await getInvoice(session, id);
  if (!inv) notFound();
  const [attachments, journal] = await Promise.all([listForEntity(session.companyId, "CustomerInvoice", id), inv.journalEntryId ? prisma.journalEntry.findUnique({ where: { id: inv.journalEntryId }, select: { number: true } }) : null]);
  const p = plain(inv);
  const doc: DocData = {
    id: p.id, number: p.number, partyId: p.customerId, branchId: p.branchId, docDate: p.invoiceDate, dueDate: p.dueDate, supplyDate: p.supplyDate, currencyCode: p.currencyCode, exchangeRate: p.exchangeRate, discountPct: p.discountPct, reference: p.reference, notes: p.notes, status: p.status, type: p.type, kind: p.kind, salespersonId: p.salespersonId, originalId: p.originalId, journalEntryId: p.journalEntryId, journalNumber: journal?.number ?? null, paidAmount: p.paidAmount, total: p.total,
    lines: p.lines.map((l) => ({ itemId: l.itemId, descriptionAr: l.descriptionAr, descriptionEn: l.descriptionEn, quantity: l.quantity, unitPrice: l.unitPrice, discountPct: l.discountPct, taxCodeId: l.taxCodeId, accountId: l.revenueAccountId, costCenterId: l.costCenterId })),
    allocations: p.allocations.map((a) => ({ id: a.receipt.id, number: a.receipt.number, date: a.receipt.receiptDate, amount: a.amount })),
    zatca: p.zatca,
  };
  return <DocEditor mode="AR" doc={doc} lookups={lk} can={perms} actions={actions} attachments={plain(attachments)} canAttach={canAttach} pdfDoc="invoice" listHref="/finance/ar/invoices" />;
}
