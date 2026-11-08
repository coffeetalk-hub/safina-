import { prisma } from "@/lib/prisma";
import { D } from "@/lib/money";
import type { PricingData } from "./pricing-client";

/** Price resolution order: customer-specific price → customer's price list (qty tiers) → default price list → item sale price. */
export async function resolvePrice(companyId: string, customerId: string | null, itemId: string, qty = 1) {
  const item = await prisma.item.findFirst({ where: { id: itemId, companyId } });
  if (!item) throw new Error("NOT_FOUND");
  let price = D(item.salePrice);
  let discountPct = D(0);
  let source = "ITEM";
  const today = new Date();
  const customer = customerId ? await prisma.customer.findFirst({ where: { id: customerId, companyId } }) : null;
  const listId = customer?.priceListId ?? (await prisma.priceList.findFirst({ where: { companyId, isDefault: true, isActive: true } }))?.id ?? null;
  if (listId) {
    const list = await prisma.priceList.findFirst({ where: { id: listId, isActive: true, OR: [{ validFrom: null }, { validFrom: { lte: today } }], AND: [{ OR: [{ validTo: null }, { validTo: { gte: today } }] }] } });
    if (list) {
      const tier = await prisma.priceListItem.findFirst({ where: { priceListId: list.id, itemId, minQty: { lte: qty } }, orderBy: { minQty: "desc" } });
      if (tier) { price = D(tier.price); source = "PRICE_LIST"; }
    }
  }
  if (customerId) {
    const cp = await prisma.customerItemPrice.findFirst({ where: { companyId, customerId, itemId } });
    if (cp) { price = D(cp.price); discountPct = D(cp.discountPct); source = "CUSTOMER"; }
  }
  return { price: price.toNumber(), discountPct: discountPct.toNumber(), source };
}

/** Serialisable pricing data for the document editor (client-side resolution mirrors resolvePrice). */
export async function pricingData(companyId: string): Promise<PricingData> {
  const [lists, customerPrices, customers] = await Promise.all([
    prisma.priceList.findMany({ where: { companyId, isActive: true }, include: { items: true } }),
    prisma.customerItemPrice.findMany({ where: { companyId } }),
    prisma.customer.findMany({ where: { companyId }, select: { id: true, priceListId: true } }),
  ]);
  return {
    defaultListId: lists.find((l) => l.isDefault)?.id ?? null,
    customerLists: Object.fromEntries(customers.map((c) => [c.id, c.priceListId])),
    lists: Object.fromEntries(lists.map((l) => [l.id, l.items.map((i) => ({ itemId: i.itemId, price: Number(i.price), minQty: Number(i.minQty) }))])),
    customerPrices: customerPrices.map((p) => ({ customerId: p.customerId, itemId: p.itemId, price: Number(p.price), discountPct: Number(p.discountPct) })),
  };
}
export type { PricingData } from "./pricing-client";
export { pickPrice } from "./pricing-client";
