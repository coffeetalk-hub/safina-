import { z } from "zod";
import { prisma, type Db } from "@/lib/prisma";
import { D, round, ZERO, computeLine } from "@/lib/money";
import type { AppSession } from "@/core/auth/session";
import type { ListParams } from "@/components/data-table/types";

/** Shared Zod schema for invoice/bill lines. */
export const docLineSchema = z.object({
  itemId: z.string().nullable().optional(),
  descriptionAr: z.string().min(1).max(500),
  descriptionEn: z.string().min(1).max(500),
  quantity: z.coerce.number().positive().default(1),
  unitPrice: z.coerce.number().min(0).default(0),
  discountPct: z.coerce.number().min(0).max(100).default(0),
  taxCodeId: z.string().nullable().optional(),
  accountId: z.string().nullable().optional(), // revenue (AR) or expense (AP)
  costCenterId: z.string().nullable().optional(),
});
export type DocLineInput = z.infer<typeof docLineSchema>;

export const docHeaderSchema = z.object({
  id: z.string().nullable().optional(),
  branchId: z.string().nullable().optional(),
  docDate: z.string().min(10),
  dueDate: z.string().min(10),
  currencyCode: z.string().length(3).default("SAR"),
  exchangeRate: z.coerce.number().positive().default(1),
  discountPct: z.coerce.number().min(0).max(100).default(0),
  reference: z.string().max(100).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  lines: z.array(docLineSchema).min(1),
});

export type ComputedLine = { net: ReturnType<typeof D>; tax: ReturnType<typeof D>; total: ReturnType<typeof D>; discountAmount: ReturnType<typeof D>; taxRate: ReturnType<typeof D> };

/** Computes line amounts with header discount applied proportionally before tax. */
export async function computeDocument(db: Db, companyId: string, lines: DocLineInput[], headerDiscountPct: number) {
  const taxIds = [...new Set(lines.map((l) => l.taxCodeId).filter(Boolean))] as string[];
  const taxes = await db.taxCode.findMany({ where: { id: { in: taxIds }, companyId } });
  const factor = D(1).minus(D(headerDiscountPct).div(100));
  const computed: ComputedLine[] = lines.map((l) => {
    const tax = taxes.find((t) => t.id === l.taxCodeId);
    const rate = tax ? D(tax.rate) : ZERO;
    const base = computeLine({ quantity: l.quantity, unitPrice: l.unitPrice, discountPct: l.discountPct, taxRate: 0 });
    const net = round(base.net.times(factor), 2);
    const taxAmt = round(net.times(rate).div(100), 2);
    return { net, tax: taxAmt, total: net.plus(taxAmt), discountAmount: base.discount.plus(base.net.minus(net)), taxRate: rate };
  });
  const subtotal = round(lines.reduce((a, l) => a.plus(D(l.quantity).times(D(l.unitPrice))), ZERO), 2);
  const discountTotal = round(computed.reduce((a, c) => a.plus(c.discountAmount), ZERO), 2);
  const taxTotal = round(computed.reduce((a, c) => a.plus(c.tax), ZERO), 2);
  const total = round(computed.reduce((a, c) => a.plus(c.total), ZERO), 2);
  return { computed, subtotal, discountTotal, taxTotal, total };
}

/** Common list `where` for party documents. */
export function docWhere(session: AppSession, p: ListParams, partyField: "customerId" | "vendorId", dateField: string) {
  const w: Record<string, unknown> = { companyId: session.companyId };
  if (p.q) w.OR = [{ number: { contains: p.q, mode: "insensitive" } }, { reference: { contains: p.q, mode: "insensitive" } }, { [partyField === "customerId" ? "customer" : "vendor"]: { OR: [{ nameAr: { contains: p.q, mode: "insensitive" } }, { nameEn: { contains: p.q, mode: "insensitive" } }, { code: { contains: p.q, mode: "insensitive" } }] } }];
  if (p.filters.status) w.status = p.filters.status;
  if (p.filters[partyField]) w[partyField] = p.filters[partyField];
  if (p.filters.branchId) w.branchId = p.filters.branchId;
  if (p.filters.type) w.type = p.filters.type;
  if (p.filters.kind) w.kind = p.filters.kind;
  if (p.filters.from || p.filters.to) w[dateField] = { gte: p.filters.from ? new Date(p.filters.from) : undefined, lte: p.filters.to ? new Date(p.filters.to) : undefined };
  return w;
}

export const OPEN_STATUSES = ["POSTED", "PARTIALLY_PAID"] as const;

/** Aging buckets for outstanding documents as of a date. */
export function agingBuckets(asOf: Date, dueDate: Date, outstanding: number) {
  const days = Math.floor((asOf.getTime() - dueDate.getTime()) / 86_400_000);
  const b = { current: 0, d1_30: 0, d31_60: 0, d61_90: 0, d90plus: 0, days };
  if (days <= 0) b.current = outstanding;
  else if (days <= 30) b.d1_30 = outstanding;
  else if (days <= 60) b.d31_60 = outstanding;
  else if (days <= 90) b.d61_90 = outstanding;
  else b.d90plus = outstanding;
  return b;
}

export { prisma };
