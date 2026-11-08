import { notFound } from "next/navigation";
import { purchasingPage } from "@/modules/purchasing/page-helpers";
import { financeLookups } from "@/modules/finance/_shared/lookups";
import { getPurchaseOrder } from "@/modules/purchasing/orders";
import { getRequest } from "@/modules/purchasing/requests";
import { cancelPoAction, confirmPoAction, convertPoAction, markPoSentAction, savePoAction } from "@/modules/purchasing/actions";
import { DocEditor, type DocData, type DocLine, type Transition } from "@/components/finance/doc-editor";
import { listForEntity } from "@/modules/foundation/attachments/service";
import { can } from "@/core/auth/session";
import { plain } from "@/components/data-table/types";

export default async function PurchaseOrderPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ vendorId?: string; requestId?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const { session, locale, t, perms } = await purchasingPage("order");
  const lk = await financeLookups(session.companyId, locale);
  const canAttach = { upload: can(session, "foundation.attachment:create"), delete: can(session, "foundation.attachment:delete") };
  const canBill = can(session, "finance.bill:create");
  const transitions: Transition[] = [
    { key: "sent", label: t("orders.markSent"), action: markPoSentAction, when: ["APPROVED"], variant: "secondary" },
    ...(canBill ? [{ key: "bill", label: t("orders.toBill"), action: convertPoAction, when: ["APPROVED", "SENT", "PARTIALLY_BILLED"], variant: "default" as const, navigateTo: "/finance/ap/bills", confirm: t("orders.toBillConfirm") }] : []),
    { key: "cancel", label: t("orders.cancel"), action: cancelPoAction, when: ["DRAFT", "PENDING_APPROVAL", "APPROVED", "SENT"], variant: "ghost" },
  ];
  if (id === "new") {
    const req = sp.requestId ? await getRequest(session, sp.requestId) : null;
    const defaultTax = lk.taxCodes.find((x) => x.meta?.isDefault)?.value ?? null;
    const initialLines: DocLine[] | undefined = req ? req.lines.map((l) => ({ itemId: l.itemId, descriptionAr: l.descriptionAr, descriptionEn: l.descriptionEn, quantity: Number(l.quantity), unitPrice: Number(l.estimatedPrice), discountPct: 0, taxCodeId: defaultTax, accountId: l.expenseAccountId, costCenterId: l.costCenterId ?? req.costCenterId })) : undefined;
    const linked = req ? [{ label: `${t("request")}: ${req.number}`, href: `/purchasing/requests/${req.id}`, status: req.status }] : [];
    return <DocEditor mode="PO" doc={null} lookups={lk} can={perms} actions={{ save: savePoAction }} attachments={[]} canAttach={canAttach} pdfDoc="purchase-order" listHref="/purchasing/orders" initialParty={sp.vendorId ?? null} initialLines={initialLines} extraPayload={req ? { requestId: req.id, branchId: req.branchId } : undefined} linkedDocs={linked} />;
  }
  const o = await getPurchaseOrder(session, id);
  if (!o) notFound();
  const attachments = await listForEntity(session.companyId, "PurchaseOrder", id);
  const p = plain(o);
  const doc: DocData = { id: p.id, number: p.number, partyId: p.vendorId, branchId: p.branchId, docDate: p.orderDate, dueDate: p.expectedDate ?? "", currencyCode: p.currencyCode, exchangeRate: p.exchangeRate, discountPct: p.discountPct, reference: p.reference, notes: p.notes, status: p.status, journalEntryId: null, paidAmount: 0, total: p.total, lines: p.lines.map((l) => ({ itemId: l.itemId, descriptionAr: l.descriptionAr, descriptionEn: l.descriptionEn, quantity: l.quantity, unitPrice: l.unitPrice, discountPct: l.discountPct, taxCodeId: l.taxCodeId, accountId: l.expenseAccountId, costCenterId: l.costCenterId })), allocations: [] };
  const linked = [
    ...(p.request ? [{ label: `${t("request")}: ${p.request.number}`, href: `/purchasing/requests/${p.request.id}` }] : []),
    ...(p.rfq ? [{ label: `${t("rfq.one")}: ${p.rfq.number}`, href: `/purchasing/rfq/${p.rfq.id}` }] : []),
    ...p.bills.map((b) => ({ label: `${t("bill")}: ${b.number}`, href: `/finance/ap/bills/${b.id}`, status: b.status })),
  ];
  return <DocEditor mode="PO" doc={doc} lookups={lk} can={perms} actions={{ save: savePoAction, post: confirmPoAction }} postLabel={t("orders.confirm")} extraPayload={{ requestId: p.requestId, rfqId: p.rfqId, contractId: p.contractId, termsAr: p.termsAr, termsEn: p.termsEn }} transitions={transitions} linkedDocs={linked} attachments={plain(attachments)} canAttach={canAttach} pdfDoc="purchase-order" listHref="/purchasing/orders" />;
}
