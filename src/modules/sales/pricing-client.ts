/** Client-safe price resolution (no server imports). Mirrors resolvePrice(). */
export type PricingData = {
  defaultListId: string | null;
  customerLists: Record<string, string | null>;
  lists: Record<string, { itemId: string; price: number; minQty: number }[]>;
  customerPrices: { customerId: string; itemId: string; price: number; discountPct: number }[];
};

export function pickPrice(p: PricingData, customerId: string | null, itemId: string, qty: number, fallback: number) {
  let price = fallback, discountPct = 0;
  const listId = (customerId && p.customerLists[customerId]) || p.defaultListId;
  const tiers = listId ? p.lists[listId] ?? [] : [];
  const tier = tiers.filter((t) => t.itemId === itemId && t.minQty <= qty).sort((a, b) => b.minQty - a.minQty)[0];
  if (tier) price = tier.price;
  const cp = customerId ? p.customerPrices.find((x) => x.customerId === customerId && x.itemId === itemId) : null;
  if (cp) { price = cp.price; discountPct = cp.discountPct; }
  return { price, discountPct };
}
