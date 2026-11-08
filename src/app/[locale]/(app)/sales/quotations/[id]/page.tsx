import { notFound } from "next/navigation";
import { salesPage } from "@/modules/sales/page-helpers";
import { financeLookups } from "@/modules/finance/_shared/lookups";
import { pricingData } from "@/modules/sales/pricing";
import { getQuotation } from "@/modules/sales/quotations";
import { convertQuotationAction, quotationStatusAction, saveQuotationAction } from "@/modules/sales/actions";
import { DocEditor, type DocData, type Transition } from "@/components/finance/doc-editor";
import { listForEntity } from "@/modules/foundation/attachments/service";
import { can } from "@/core/auth/session";
import { plain } from "@/components/data-table/types";

export default async function QuotationPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ customerId?: string; opportunityId?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const { session, locale, t, perms } = await salesPage("quotation");
  const [lk, pricing] = await Promise.all([financeLookups(session.companyId, locale), pricingData(session.companyId)]);
  const canAttach = { upload: can(session, "foundation.attachment:create"), delete: can(session, "foundation.attachment:delete") };
  const st = (status: "SENT" | "ACCEPTED" | "REJECTED" | "EXPIRED" | "CANCELLED" | "DRAFT") => async (qid: string) => { "use server"; return quotationStatusAction({ id: qid, status }); };
  const transitions: Transition[] = [
    { key: "send", label: t("quotations.send"), action: st("SENT"), when: ["DRAFT"], variant: "secondary" },
    { key: "accept", label: t("quotations.accept"), action: st("ACCEPTED"), when: ["SENT"], variant: "default" },
    { key: "reject", label: t("quotations.reject"), action: st("REJECTED"), when: ["SENT"], variant: "outline" },
    { key: "reopen", label: t("quotations.reopen"), action: st("DRAFT"), when: ["SENT", "REJECTED", "EXPIRED"], variant: "ghost" },
    { key: "convert", label: t("quotations.toOrder"), action: convertQuotationAction, when: ["SENT", "ACCEPTED"], variant: "default", navigateTo: "/sales/orders", confirm: t("quotations.toOrderConfirm") },
    { key: "cancel", label: t("quotations.cancel"), action: st("CANCELLED"), when: ["DRAFT"], variant: "ghost" },
  ];
  const saveWithOpp = sp.opportunityId ? async (input: unknown) => { "use server"; return saveQuotationAction({ ...(input as object), opportunityId: sp.opportunityId }); } : saveQuotationAction;
  if (id === "new") return <DocEditor mode="QUOTE" doc={null} lookups={lk} pricing={pricing} can={perms} actions={{ save: saveWithOpp }} attachments={[]} canAttach={canAttach} pdfDoc="quotation" listHref="/sales/quotations" initialParty={sp.customerId ?? null} />;
  const q = await getQuotation(session, id);
  if (!q) notFound();
  const attachments = await listForEntity(session.companyId, "Quotation", id);
  const p = plain(q);
  const doc: DocData = { id: p.id, number: p.number, partyId: p.customerId, branchId: p.branchId, docDate: p.quoteDate, dueDate: p.validUntil, currencyCode: p.currencyCode, exchangeRate: p.exchangeRate, discountPct: p.discountPct, reference: p.reference, notes: p.notes, status: p.status, salespersonId: p.salespersonId, journalEntryId: null, paidAmount: 0, total: p.total, lines: p.lines.map((l) => ({ itemId: l.itemId, descriptionAr: l.descriptionAr, descriptionEn: l.descriptionEn, quantity: l.quantity, unitPrice: l.unitPrice, discountPct: l.discountPct, taxCodeId: l.taxCodeId, accountId: l.revenueAccountId, costCenterId: l.costCenterId })), allocations: [] };
  const linked = [...(p.opportunity ? [{ label: `${t("opportunity")}: ${locale === "ar" ? p.opportunity.titleAr : p.opportunity.titleEn}`, href: `/sales/opportunities/${p.opportunity.id}` }] : []), ...(p.salesOrderId ? [{ label: `${t("salesOrder")} →`, href: `/sales/orders/${p.salesOrderId}` }] : [])];
  return <DocEditor mode="QUOTE" doc={doc} lookups={lk} pricing={pricing} can={perms} actions={{ save: saveQuotationAction }} transitions={transitions} linkedDocs={linked} attachments={plain(attachments)} canAttach={canAttach} pdfDoc="quotation" listHref="/sales/quotations" />;
}
