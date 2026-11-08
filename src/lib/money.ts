import { Prisma } from "@prisma/client";

export type Decimal = Prisma.Decimal;
export const D = (v: Prisma.Decimal.Value | null | undefined) => new Prisma.Decimal(v ?? 0);

export const ZERO = new Prisma.Decimal(0);

/** Round half-up to `dp` decimals (default 2 — SAR halalas). */
export function round(v: Prisma.Decimal.Value, dp = 2): Prisma.Decimal {
  return new Prisma.Decimal(v).toDecimalPlaces(dp, Prisma.Decimal.ROUND_HALF_UP);
}

export function sum(values: Prisma.Decimal.Value[]): Prisma.Decimal {
  return values.reduce<Prisma.Decimal>((acc, v) => acc.plus(v ?? 0), ZERO);
}

/** Compute line amounts. Discount can be percent or fixed amount per line. */
export function computeLine(input: {
  quantity: Prisma.Decimal.Value;
  unitPrice: Prisma.Decimal.Value;
  discountPct?: Prisma.Decimal.Value;
  discountAmount?: Prisma.Decimal.Value;
  taxRate: Prisma.Decimal.Value; // percent
}) {
  const gross = D(input.quantity).times(D(input.unitPrice));
  const discount = input.discountAmount
    ? D(input.discountAmount)
    : gross.times(D(input.discountPct ?? 0)).div(100);
  const net = gross.minus(discount);
  const tax = net.times(D(input.taxRate)).div(100);
  return {
    gross: round(gross, 4),
    discount: round(discount, 4),
    net: round(net, 4),
    tax: round(tax, 4),
    total: round(net.plus(tax), 4),
  };
}

export function toBase(amount: Prisma.Decimal.Value, rate: Prisma.Decimal.Value) {
  return round(D(amount).times(D(rate)), 4);
}

export function formatMoney(v: Prisma.Decimal.Value | null | undefined, locale = "ar", currency = "SAR") {
  const n = Number(v ?? 0);
  return new Intl.NumberFormat(locale === "ar" ? "ar-SA-u-nu-latn" : "en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

export function formatNumber(v: Prisma.Decimal.Value | null | undefined, locale = "ar", dp = 2) {
  return new Intl.NumberFormat(locale === "ar" ? "ar-SA-u-nu-latn" : "en-US", {
    minimumFractionDigits: dp,
    maximumFractionDigits: dp,
  }).format(Number(v ?? 0));
}
