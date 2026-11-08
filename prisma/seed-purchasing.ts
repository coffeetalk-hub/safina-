/** Purchasing demo data for the first company: requests, RFQ with 3 vendor quotes → award → PO, direct PO → bill, contracts, evaluations. */
import { prisma } from "../src/lib/prisma";
import type { AppSession } from "../src/core/auth/session";
import { saveRequest, submitRequest } from "../src/modules/purchasing/requests";
import { rfqFromRequest, setRfqStatus, saveQuote, awardRfq } from "../src/modules/purchasing/rfq";
import { savePurchaseOrder, confirmPurchaseOrder, markPoSent, convertPoToBill } from "../src/modules/purchasing/orders";
import { contracts } from "../src/modules/purchasing/contracts";
import { evaluations } from "../src/modules/purchasing/evaluations";

const iso = (d: Date) => d.toISOString().slice(0, 10);
const days = (n: number) => { const d = new Date(); d.setUTCDate(d.getUTCDate() + n); return d; };

export async function seedPurchasing(companyId: string, userId: string) {
  if ((await prisma.purchaseRequest.count({ where: { companyId } })) > 0) { console.log("  purchasing demo data already present — skipping"); return; }
  const s = { userId, companyId, email: "seed", nameAr: "seed", nameEn: "seed", locale: "en", isSuperAdmin: true, companyIds: [companyId], branchId: null, permissions: new Set(["*"]) } as AppSession;
  const vendors = await prisma.vendor.findMany({ where: { companyId }, orderBy: { code: "asc" } });
  const items = await prisma.item.findMany({ where: { companyId, isPurchasable: true }, orderBy: { code: "asc" } });
  const employees = await prisma.employee.findMany({ where: { companyId }, orderBy: { code: "asc" } });
  const costCenters = await prisma.costCenter.findMany({ where: { companyId }, orderBy: { code: "asc" } });
  const vat15 = await prisma.taxCode.findFirstOrThrow({ where: { companyId, code: "VAT15" } });
  const it = (i: number) => items[i % items.length];
  const prLine = (i: number, qty: number, price: number) => ({ itemId: it(i).id, descriptionAr: it(i).nameAr, descriptionEn: it(i).nameEn, quantity: qty, unit: it(i).unit, estimatedPrice: price, expenseAccountId: it(i).expenseAccountId, costCenterId: costCenters[0]?.id ?? null });

  // 1) Request → approve → RFQ (3 vendors) → quotes → award → draft PO
  const pr1 = await saveRequest(s, { requestDate: iso(days(-14)), neededBy: iso(days(14)), requesterId: employees[2]?.id, costCenterId: costCenters[0]?.id, purpose: "Laptops and licences for the new hires", priority: "HIGH", lines: [prLine(0, 5, 4500), prLine(1, 5, 900)] });
  await submitRequest(s, pr1.id);
  await prisma.purchaseRequest.update({ where: { id: pr1.id }, data: { status: "APPROVED" } });
  const rfq = await rfqFromRequest(s, pr1.id, vendors.slice(0, 3).map((v) => v.id));
  await setRfqStatus(s, rfq.id, "SENT");
  const full = await prisma.rfq.findUniqueOrThrow({ where: { id: rfq.id }, include: { lines: true } });
  const factors = [1.0, 0.93, 1.08];
  for (const [i, v] of vendors.slice(0, 3).entries()) {
    await saveQuote(s, { rfqId: rfq.id, vendorId: v.id, quoteRef: `Q-${v.code}-${1040 + i}`, quoteDate: iso(days(-7 + i)), validUntil: iso(days(23)), leadDays: [10, 14, 7][i], paymentTerms: ["Net 30", "Net 45", "50% advance"][i], currencyCode: "SAR", lines: full.lines.map((l, j) => ({ rfqLineId: l.id, unitPrice: Math.round([4500, 900][j] * factors[i]) })) });
  }
  await awardRfq(s, rfq.id, vendors[1].id);

  // 2) Request → direct PO → confirm → sent → bill (draft)
  const pr2 = await saveRequest(s, { requestDate: iso(days(-30)), neededBy: iso(days(-10)), requesterId: employees[4]?.id, costCenterId: costCenters[1]?.id ?? costCenters[0]?.id, purpose: "Office cleaning services – Q4", priority: "NORMAL", lines: [prLine(2, 3, 2500)] });
  await submitRequest(s, pr2.id);
  await prisma.purchaseRequest.update({ where: { id: pr2.id }, data: { status: "APPROVED" } });
  const po2 = await savePurchaseOrder(s, { vendorId: vendors[3].id, requestId: pr2.id, docDate: iso(days(-25)), dueDate: iso(days(-10)), currencyCode: "SAR", exchangeRate: 1, discountPct: 0, reference: "VQ-2211", termsEn: "Delivery to head office. Payment Net 30.", termsAr: "التسليم إلى المكتب الرئيسي. الدفع خلال 30 يومًا.", lines: [{ itemId: it(2).id, descriptionAr: it(2).nameAr, descriptionEn: it(2).nameEn, quantity: 3, unitPrice: 2500, discountPct: 0, taxCodeId: vat15.id, accountId: it(2).expenseAccountId, costCenterId: costCenters[1]?.id ?? null }] });
  await confirmPurchaseOrder(s, po2.id);
  await markPoSent(s, po2.id);
  await convertPoToBill(s, po2.id);

  // 3) Large PO (> 10,000) → pending approval via policy
  const po3 = await savePurchaseOrder(s, { vendorId: vendors[4].id, docDate: iso(days(-2)), dueDate: iso(days(20)), currencyCode: "SAR", exchangeRate: 1, discountPct: 0, reference: "VQ-3310", lines: [{ itemId: it(3).id, descriptionAr: it(3).nameAr, descriptionEn: it(3).nameEn, quantity: 10, unitPrice: 1800, discountPct: 0, taxCodeId: vat15.id, accountId: it(3).expenseAccountId, costCenterId: null }] });
  await confirmPurchaseOrder(s, po3.id);

  // 4) Draft request + urgent pending-approval request
  await saveRequest(s, { requestDate: iso(days(-1)), neededBy: iso(days(7)), requesterId: employees[6]?.id, purpose: "Marketing printing for the exhibition", priority: "URGENT", lines: [prLine(4, 200, 12), prLine(5, 2, 1500)] });

  // Contracts
  await contracts.save(s, { vendorId: vendors[0].id, titleAr: "عقد دعم وصيانة سنوي", titleEn: "Annual support & maintenance", startDate: iso(days(-340)), endDate: iso(days(25)), value: 48000, currencyCode: "SAR", alertDays: 30, autoRenew: false, status: "ACTIVE", ownerId: employees[2]?.id, termsEn: "Response within 4 business hours.", termsAr: "الاستجابة خلال 4 ساعات عمل." });
  await contracts.save(s, { vendorId: vendors[3].id, titleAr: "عقد خدمات النظافة", titleEn: "Cleaning services contract", startDate: iso(days(-90)), endDate: iso(days(275)), value: 36000, currencyCode: "SAR", alertDays: 45, autoRenew: true, status: "ACTIVE", ownerId: employees[4]?.id, termsAr: null, termsEn: null });
  await contracts.save(s, { vendorId: vendors[6].id, titleAr: "اتفاقية توريد قرطاسية", titleEn: "Stationery supply agreement", startDate: iso(days(-400)), endDate: iso(days(-35)), value: 12000, currencyCode: "SAR", alertDays: 30, autoRenew: false, status: "EXPIRED", ownerId: null, termsAr: null, termsEn: null });

  // Evaluations
  const ev = (vi: number, q: number, d: number, p: number, sv: number, c: number, period: string, daysAgo: number) => evaluations.save(s, { vendorId: vendors[vi].id, evalDate: iso(days(-daysAgo)), periodLabel: period, quality: q, delivery: d, price: p, service: sv, compliance: c, comments: null });
  await ev(0, 5, 4, 3, 5, 5, "2026-Q2", 120); await ev(0, 4, 4, 3, 4, 5, "2026-Q3", 30);
  await ev(1, 4, 5, 5, 3, 4, "2026-Q3", 28); await ev(3, 3, 2, 4, 3, 4, "2026-Q3", 25); await ev(4, 5, 5, 2, 4, 5, "2026-Q3", 20);
  console.log("  purchasing demo data created");
}
