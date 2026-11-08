import { notFound } from "next/navigation";
import { financePage } from "@/modules/finance/_shared/page-helpers";
import { financeLookups } from "@/modules/finance/_shared/lookups";
import { getBill } from "@/modules/finance/ap/bills";
import { cancelBillAction, postBillAction, reverseBillAction, saveBillAction } from "@/modules/finance/ap/actions";
import { DocEditor, type DocData } from "@/components/finance/doc-editor";
import { listForEntity } from "@/modules/foundation/attachments/service";
import { can } from "@/core/auth/session";
import { plain } from "@/components/data-table/types";
import { prisma } from "@/lib/prisma";

export default async function BillPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ vendorId?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const { session, locale, perms } = await financePage("bill");
  const lk = await financeLookups(session.companyId, locale);
  const actions = { save: saveBillAction, post: postBillAction, cancel: cancelBillAction, reverse: reverseBillAction };
  const canAttach = { upload: can(session, "foundation.attachment:create"), delete: can(session, "foundation.attachment:delete") };
  if (id === "new") return <DocEditor mode="AP" doc={null} lookups={lk} can={perms} actions={actions} attachments={[]} canAttach={canAttach} pdfDoc="bill" listHref="/finance/ap/bills" initialParty={sp.vendorId ?? null} />;
  const b = await getBill(session, id);
  if (!b) notFound();
  const [attachments, journal] = await Promise.all([listForEntity(session.companyId, "VendorBill", id), b.journalEntryId ? prisma.journalEntry.findUnique({ where: { id: b.journalEntryId }, select: { number: true } }) : null]);
  const p = plain(b);
  const doc: DocData = {
    id: p.id, number: p.number, partyId: p.vendorId, branchId: p.branchId, docDate: p.billDate, dueDate: p.dueDate, currencyCode: p.currencyCode, exchangeRate: p.exchangeRate, discountPct: 0, reference: p.reference, notes: p.notes, status: p.status, vendorInvoiceNumber: p.vendorInvoiceNumber, journalEntryId: p.journalEntryId, journalNumber: journal?.number ?? null, paidAmount: p.paidAmount, total: p.total,
    lines: p.lines.map((l) => ({ itemId: l.itemId, descriptionAr: l.descriptionAr, descriptionEn: l.descriptionEn, quantity: l.quantity, unitPrice: l.unitPrice, discountPct: l.discountPct, taxCodeId: l.taxCodeId, accountId: l.expenseAccountId, costCenterId: l.costCenterId })),
    allocations: p.allocations.map((a) => ({ id: a.payment.id, number: a.payment.number, date: a.payment.paymentDate, amount: a.amount })),
  };
  return <DocEditor mode="AP" doc={doc} lookups={lk} can={perms} actions={actions} attachments={plain(attachments)} canAttach={canAttach} pdfDoc="bill" listHref="/finance/ap/bills" />;
}
