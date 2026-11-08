import { prisma } from "@/lib/prisma";
import type { AppSession } from "@/core/auth/session";
import { D } from "@/lib/money";

type F = { from: Date; to: Date; branchId?: string | null; salespersonId?: string | null; customerId?: string | null };
const POSTED = ["POSTED", "PARTIALLY_PAID", "PAID"] as const;

function where(session: AppSession, f: F) {
  return { companyId: session.companyId, status: { in: [...POSTED] }, invoiceDate: { gte: f.from, lte: f.to }, branchId: f.branchId || undefined, salespersonId: f.salespersonId || undefined, customerId: f.customerId || undefined };
}
const sign = (kind: string) => (kind === "CREDIT_NOTE" ? -1 : 1);

export async function salesByCustomer(session: AppSession, f: F) {
  const rows = await prisma.customerInvoice.findMany({ where: where(session, f), include: { customer: { select: { code: true, nameAr: true, nameEn: true } } } });
  const m = new Map<string, { code: string; nameAr: string; nameEn: string; invoices: number; net: number; vat: number; total: number; paid: number }>();
  for (const r of rows) {
    const k = r.customerId; const s = sign(r.kind);
    const e = m.get(k) ?? { ...r.customer, invoices: 0, net: 0, vat: 0, total: 0, paid: 0 };
    e.invoices += 1; e.net += s * D(r.subtotal).minus(r.discountTotal).times(r.exchangeRate).toNumber(); e.vat += s * D(r.taxTotal).times(r.exchangeRate).toNumber(); e.total += s * Number(r.baseTotal); e.paid += s * D(r.paidAmount).times(r.exchangeRate).toNumber();
    m.set(k, e);
  }
  return [...m.values()].sort((a, b) => b.total - a.total);
}
export async function salesBySalesperson(session: AppSession, f: F) {
  const rows = await prisma.customerInvoice.findMany({ where: where(session, f) });
  const emps = await prisma.employee.findMany({ where: { companyId: session.companyId }, select: { id: true, code: true, firstNameAr: true, lastNameAr: true, firstNameEn: true, lastNameEn: true } });
  const m = new Map<string, { code: string; nameAr: string; nameEn: string; invoices: number; net: number; total: number }>();
  for (const r of rows) {
    const k = r.salespersonId ?? "-"; const e0 = emps.find((x) => x.id === k); const s = sign(r.kind);
    const e = m.get(k) ?? { code: e0?.code ?? "-", nameAr: e0 ? `${e0.firstNameAr} ${e0.lastNameAr}` : "غير محدد", nameEn: e0 ? `${e0.firstNameEn} ${e0.lastNameEn}` : "Unassigned", invoices: 0, net: 0, total: 0 };
    e.invoices += 1; e.net += s * D(r.subtotal).minus(r.discountTotal).times(r.exchangeRate).toNumber(); e.total += s * Number(r.baseTotal);
    m.set(k, e);
  }
  return [...m.values()].sort((a, b) => b.total - a.total);
}
export async function salesByItem(session: AppSession, f: F) {
  const lines = await prisma.invoiceLine.findMany({ where: { invoice: where(session, f) }, include: { invoice: { select: { kind: true, exchangeRate: true } }, item: { select: { code: true, nameAr: true, nameEn: true } } } });
  const m = new Map<string, { code: string; nameAr: string; nameEn: string; quantity: number; net: number; vat: number; total: number }>();
  for (const l of lines) {
    const k = l.itemId ?? l.descriptionEn; const s = sign(l.invoice.kind);
    const e = m.get(k) ?? { code: l.item?.code ?? "-", nameAr: l.item?.nameAr ?? l.descriptionAr, nameEn: l.item?.nameEn ?? l.descriptionEn, quantity: 0, net: 0, vat: 0, total: 0 };
    e.quantity += s * Number(l.quantity); e.net += s * D(l.net).times(l.invoice.exchangeRate).toNumber(); e.vat += s * D(l.tax).times(l.invoice.exchangeRate).toNumber(); e.total += s * D(l.total).times(l.invoice.exchangeRate).toNumber();
    m.set(k, e);
  }
  return [...m.values()].sort((a, b) => b.total - a.total);
}
export async function salesByPeriod(session: AppSession, f: F) {
  const rows = await prisma.customerInvoice.findMany({ where: where(session, f) });
  const m = new Map<string, { period: string; invoices: number; net: number; vat: number; total: number }>();
  for (const r of rows) {
    const k = r.invoiceDate.toISOString().slice(0, 7); const s = sign(r.kind);
    const e = m.get(k) ?? { period: k, invoices: 0, net: 0, vat: 0, total: 0 };
    e.invoices += 1; e.net += s * D(r.subtotal).minus(r.discountTotal).times(r.exchangeRate).toNumber(); e.vat += s * D(r.taxTotal).times(r.exchangeRate).toNumber(); e.total += s * Number(r.baseTotal);
    m.set(k, e);
  }
  return [...m.values()].sort((a, b) => a.period.localeCompare(b.period));
}
