import { notFound } from "next/navigation";
import { financePage } from "@/modules/finance/_shared/page-helpers";
import { financeLookups } from "@/modules/finance/_shared/lookups";
import { getPayment, openBills } from "@/modules/finance/ap/payments";
import { deletePaymentAction, openBillsAction, postPaymentAction, reversePaymentAction, savePaymentAction } from "@/modules/finance/ap/actions";
import { SettlementEditor, type SettlementData } from "@/components/finance/settlement-editor";
import { listForEntity } from "@/modules/foundation/attachments/service";
import { can } from "@/core/auth/session";
import { plain } from "@/components/data-table/types";

export default async function PaymentPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ vendorId?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const { session, locale, perms } = await financePage("payment");
  const lk = await financeLookups(session.companyId, locale);
  const actions = { save: savePaymentAction, post: postPaymentAction, reverse: reversePaymentAction, remove: deletePaymentAction, loadOpen: openBillsAction };
  const canAttach = { upload: can(session, "foundation.attachment:create"), delete: can(session, "foundation.attachment:delete") };
  const mapOpen = (rows: Awaited<ReturnType<typeof openBills>>) => plain(rows).map((r) => ({ id: r.id, number: r.number, date: r.billDate, dueDate: r.dueDate, total: r.total, outstanding: r.outstanding, allocated: r.allocated, ref: r.vendorInvoiceNumber }));
  if (id === "new") {
    const open = sp.vendorId ? mapOpen(await openBills(session, sp.vendorId)) : [];
    return <SettlementEditor mode="AP" doc={null} lookups={lk} can={perms} actions={actions} attachments={[]} canAttach={canAttach} pdfDoc="payment" listHref="/finance/ap/payments" initialOpen={open} initialParty={sp.vendorId ?? null} />;
  }
  const r = await getPayment(session, id);
  if (!r) notFound();
  const [attachments, open] = await Promise.all([listForEntity(session.companyId, "Payment", id), r.status === "DRAFT" ? openBills(session, r.vendorId, r.id) : Promise.resolve([])]);
  const p = plain(r);
  const doc: SettlementData = { id: p.id, number: p.number, partyId: p.vendorId, branchId: p.branchId, date: p.paymentDate, method: p.method, bankAccountId: p.bankAccountId, currencyCode: p.currencyCode, exchangeRate: p.exchangeRate, amount: p.amount, reference: p.reference, notes: p.notes, status: p.status, journalEntryId: p.journalEntryId, allocations: p.allocations.map((a) => ({ docId: a.billId, amount: a.amount })) };
  const initialOpen = r.status === "DRAFT" ? mapOpen(open) : p.allocations.map((a) => ({ id: a.bill.id, number: a.bill.number, date: a.bill.billDate, dueDate: a.bill.dueDate, total: a.bill.total, outstanding: a.amount, allocated: a.amount, ref: a.bill.vendorInvoiceNumber }));
  return <SettlementEditor mode="AP" doc={doc} lookups={lk} can={perms} actions={actions} attachments={plain(attachments)} canAttach={canAttach} pdfDoc="payment" listHref="/finance/ap/payments" initialOpen={initialOpen} />;
}
