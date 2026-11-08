import { prisma } from "@/lib/prisma";
import type { AppSession } from "@/core/auth/session";
import { D } from "@/lib/money";

type F = { from: Date; to: Date; branchId?: string | null; vendorId?: string | null };
const POSTED = ["POSTED", "PARTIALLY_PAID", "PAID"] as const;
const where = (s: AppSession, f: F) => ({ companyId: s.companyId, status: { in: [...POSTED] }, billDate: { gte: f.from, lte: f.to }, branchId: f.branchId || undefined, vendorId: f.vendorId || undefined });

export async function purchasesByVendor(session: AppSession, f: F) {
  const rows = await prisma.vendorBill.findMany({ where: where(session, f), include: { vendor: { select: { code: true, nameAr: true, nameEn: true } } } });
  const m = new Map<string, { code: string; nameAr: string; nameEn: string; bills: number; net: number; vat: number; total: number; paid: number }>();
  for (const r of rows) { const e = m.get(r.vendorId) ?? { ...r.vendor, bills: 0, net: 0, vat: 0, total: 0, paid: 0 }; e.bills++; e.net += D(r.subtotal).minus(r.discountTotal).times(r.exchangeRate).toNumber(); e.vat += D(r.taxTotal).times(r.exchangeRate).toNumber(); e.total += Number(r.baseTotal); e.paid += D(r.paidAmount).times(r.exchangeRate).toNumber(); m.set(r.vendorId, e); }
  return [...m.values()].sort((a, b) => b.total - a.total);
}
export async function purchasesByItem(session: AppSession, f: F) {
  const lines = await prisma.billLine.findMany({ where: { bill: where(session, f) }, include: { bill: { select: { exchangeRate: true } }, item: { select: { code: true, nameAr: true, nameEn: true } } } });
  const m = new Map<string, { code: string; nameAr: string; nameEn: string; quantity: number; net: number; total: number }>();
  for (const l of lines) { const k = l.itemId ?? l.descriptionEn; const e = m.get(k) ?? { code: l.item?.code ?? "-", nameAr: l.item?.nameAr ?? l.descriptionAr, nameEn: l.item?.nameEn ?? l.descriptionEn, quantity: 0, net: 0, total: 0 }; e.quantity += Number(l.quantity); e.net += D(l.net).times(l.bill.exchangeRate).toNumber(); e.total += D(l.total).times(l.bill.exchangeRate).toNumber(); m.set(k, e); }
  return [...m.values()].sort((a, b) => b.total - a.total);
}
export async function purchasesByPeriod(session: AppSession, f: F) {
  const rows = await prisma.vendorBill.findMany({ where: where(session, f) });
  const m = new Map<string, { period: string; bills: number; net: number; vat: number; total: number }>();
  for (const r of rows) { const k = r.billDate.toISOString().slice(0, 7); const e = m.get(k) ?? { period: k, bills: 0, net: 0, vat: 0, total: 0 }; e.bills++; e.net += D(r.subtotal).minus(r.discountTotal).times(r.exchangeRate).toNumber(); e.vat += D(r.taxTotal).times(r.exchangeRate).toNumber(); e.total += Number(r.baseTotal); m.set(k, e); }
  return [...m.values()].sort((a, b) => a.period.localeCompare(b.period));
}
/** Pending approvals across purchasing document types. */
export async function pendingPurchasingApprovals(session: AppSession) {
  const reqs = await prisma.approvalRequest.findMany({ where: { companyId: session.companyId, status: "PENDING", docType: { in: ["PURCHASE_REQUEST", "PURCHASE_ORDER", "BILL", "PAYMENT"] } }, include: { policy: { include: { steps: { orderBy: { order: "asc" }, include: { role: { select: { nameAr: true, nameEn: true } } } } } } }, orderBy: { createdAt: "asc" } });
  const users = await prisma.user.findMany({ where: { id: { in: reqs.map((r) => r.requestedById) } }, select: { id: true, nameAr: true, nameEn: true } });
  return reqs.map((r) => { const step = r.policy?.steps[r.currentStep - 1]; const u = users.find((x) => x.id === r.requestedById); return { id: r.id, docType: r.docType, docId: r.docId, docNumber: r.docNumber ?? "", amount: Number(r.amount), step: `${r.currentStep}/${r.totalSteps}`, stepAr: step?.nameAr ?? "", stepEn: step?.nameEn ?? "", approverAr: step?.role?.nameAr ?? "", approverEn: step?.role?.nameEn ?? "", requesterAr: u?.nameAr ?? "", requesterEn: u?.nameEn ?? "", createdAt: r.createdAt, ageDays: Math.floor((Date.now() - r.createdAt.getTime()) / 86_400_000) }; });
}
