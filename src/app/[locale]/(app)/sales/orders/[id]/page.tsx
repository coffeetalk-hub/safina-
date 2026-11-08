import { notFound } from "next/navigation";
import { salesPage } from "@/modules/sales/page-helpers";
import { financeLookups } from "@/modules/finance/_shared/lookups";
import { pricingData } from "@/modules/sales/pricing";
import { getOrder } from "@/modules/sales/quotations";
import { cancelOrderAction, confirmOrderAction, convertOrderAction, saveOrderAction } from "@/modules/sales/actions";
import { DocEditor, type DocData, type Transition } from "@/components/finance/doc-editor";
import { listForEntity } from "@/modules/foundation/attachments/service";
import { can } from "@/core/auth/session";
import { plain } from "@/components/data-table/types";

export default async function OrderPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ customerId?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const { session, locale, t, perms } = await salesPage("order");
  const [lk, pricing] = await Promise.all([financeLookups(session.companyId, locale), pricingData(session.companyId)]);
  const canAttach = { upload: can(session, "foundation.attachment:create"), delete: can(session, "foundation.attachment:delete") };
  const transitions: Transition[] = [
    { key: "invoice", label: t("orders.toInvoice"), action: convertOrderAction, when: ["CONFIRMED", "PARTIALLY_INVOICED"], variant: "default", navigateTo: "/finance/ar/invoices", confirm: t("orders.toInvoiceConfirm") },
    { key: "cancel", label: t("orders.cancel"), action: cancelOrderAction, when: ["DRAFT", "CONFIRMED"], variant: "ghost" },
  ];
  if (id === "new") return <DocEditor mode="ORDER" doc={null} lookups={lk} pricing={pricing} can={perms} actions={{ save: saveOrderAction }} attachments={[]} canAttach={canAttach} pdfDoc="sales-order" listHref="/sales/orders" initialParty={sp.customerId ?? null} />;
  const o = await getOrder(session, id);
  if (!o) notFound();
  const attachments = await listForEntity(session.companyId, "SalesOrder", id);
  const p = plain(o);
  const doc: DocData = { id: p.id, number: p.number, partyId: p.customerId, branchId: p.branchId, docDate: p.orderDate, dueDate: p.deliveryDate ?? "", currencyCode: p.currencyCode, exchangeRate: p.exchangeRate, discountPct: p.discountPct, reference: p.reference, notes: p.notes, status: p.status, salespersonId: p.salespersonId, journalEntryId: null, paidAmount: 0, total: p.total, lines: p.lines.map((l) => ({ itemId: l.itemId, descriptionAr: l.descriptionAr, descriptionEn: l.descriptionEn, quantity: l.quantity, unitPrice: l.unitPrice, discountPct: l.discountPct, taxCodeId: l.taxCodeId, accountId: l.revenueAccountId, costCenterId: l.costCenterId })), allocations: [] };
  const linked = [...(p.quotationId ? [{ label: `${t("quotation")} ←`, href: `/sales/quotations/${p.quotationId}` }] : []), ...p.invoices.map((i) => ({ label: i.number, href: `/finance/ar/invoices/${i.id}`, status: i.status }))];
  return <DocEditor mode="ORDER" doc={doc} lookups={lk} pricing={pricing} can={perms} actions={{ save: saveOrderAction, post: confirmOrderAction }} postLabel={t("orders.confirm")} transitions={transitions} linkedDocs={linked} attachments={plain(attachments)} canAttach={canAttach} pdfDoc="sales-order" listHref="/sales/orders" />;
}
