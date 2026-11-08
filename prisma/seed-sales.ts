/** Sales & CRM demo data for the first company: stages, leads, opportunities, quotations, orders, price list, portal user. */
import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/prisma";
import type { AppSession } from "../src/core/auth/session";
import { ensureStages, convertLead } from "../src/modules/sales/crm";
import { saveQuotation, setQuotationStatus, convertQuotationToOrder, confirmOrder } from "../src/modules/sales/quotations";
import { savePriceList, saveCustomerPricing } from "../src/modules/sales/price-lists";

const iso = (d: Date) => d.toISOString().slice(0, 10);
const days = (n: number) => { const d = new Date(); d.setUTCDate(d.getUTCDate() + n); return d; };

export async function seedSales(companyId: string, userId: string) {
  if ((await prisma.quotation.count({ where: { companyId } })) > 0) { console.log("  sales demo data already present — skipping"); return; }
  const s = { userId, companyId, email: "seed", nameAr: "seed", nameEn: "seed", locale: "en", isSuperAdmin: true, companyIds: [companyId], branchId: null, permissions: new Set(["*"]) } as AppSession;
  await ensureStages(companyId);
  const stages = await prisma.pipelineStage.findMany({ where: { companyId }, orderBy: { order: "asc" } });
  const st = (code: string) => stages.find((x) => x.code === code)!;
  const sales = await prisma.employee.findMany({ where: { companyId, isSalesperson: true } });
  const customers = await prisma.customer.findMany({ where: { companyId }, orderBy: { code: "asc" } });
  const items = await prisma.item.findMany({ where: { companyId }, orderBy: { code: "asc" } });
  const byCode = (code: string) => items.find((i) => i.code === code) ?? items[0];
  const vat15 = await prisma.taxCode.findFirstOrThrow({ where: { companyId, code: "VAT15" } });

  // Price list + customer pricing
  const pl = await savePriceList(s, { code: "WHOLESALE", nameAr: "أسعار الجملة", nameEn: "Wholesale", currencyCode: "SAR", isDefault: false, isActive: true, items: items.slice(0, 6).map((i) => ({ itemId: i.id, price: Math.round(Number(i.salePrice) * 0.9), minQty: 0 })).concat([{ itemId: items[0].id, price: Math.round(Number(items[0].salePrice) * 0.8), minQty: 50 }]) });
  await saveCustomerPricing(s, { customerId: customers[0].id, priceListId: pl.id, prices: [{ itemId: byCode("SRV-DEV").id, price: 3000, discountPct: 0 }] });

  // Leads
  const leadRows = [
    { nameAr: "سعد المطيري", nameEn: "Saad Almutairi", companyName: "Almutairi Trading", contactPerson: "Saad", email: "saad@almutairi.example", phone: "+966555000111", source: "Website", status: "NEW" as const },
    { nameAr: "هند العتيبي", nameEn: "Hind Alotaibi", companyName: "Hind Design Studio", contactPerson: "Hind", email: "hind@design.example", phone: "+966555000222", source: "Referral", status: "CONTACTED" as const },
    { nameAr: "شركة الأفق", nameEn: "Horizon Co.", companyName: "Horizon Co.", contactPerson: "Omar", email: "omar@horizon.example", phone: "+966555000333", source: "Exhibition", status: "QUALIFIED" as const },
    { nameAr: "مؤسسة الرواد", nameEn: "Pioneers Est.", companyName: "Pioneers Est.", contactPerson: "Lina", email: "lina@pioneers.example", phone: "+966555000444", source: "LinkedIn", status: "NEW" as const },
  ];
  const leads = [];
  for (const [i, l] of leadRows.entries()) leads.push(await prisma.lead.create({ data: { companyId, ...l, ownerId: sales[i % sales.length]?.id ?? null, createdById: userId } }));
  await convertLead(s, leads[2].id);

  // Opportunities
  const opps = [
    { titleAr: "تطبيق جوال للنخيل", titleEn: "Mobile app for Al Nakheel", customerId: customers[0].id, stage: "PROPOSAL", amount: 180000, close: 30 },
    { titleAr: "دعم فني سنوي – البحر الأحمر", titleEn: "Annual support – Red Sea", customerId: customers[1].id, stage: "NEGOTIATION", amount: 96000, close: 15 },
    { titleAr: "تدقيق أمني – الخليج الرقمية", titleEn: "Security audit – Gulf Digital", customerId: customers[2].id, stage: "QUALIFIED", amount: 25000, close: 45 },
    { titleAr: "تراخيص ERP – الواحة", titleEn: "ERP licences – Al Waha", customerId: customers[5].id, stage: "NEW", amount: 54000, close: 60 },
    { titleAr: "هوية بصرية – نور", titleEn: "Brand identity – Noor", customerId: customers[8].id, stage: "WON", amount: 15000, close: -5 },
  ];
  const created = [];
  for (const [i, o] of opps.entries()) {
    const stage = st(o.stage);
    created.push(await prisma.opportunity.create({ data: { companyId, titleAr: o.titleAr, titleEn: o.titleEn, customerId: o.customerId, stageId: stage.id, ownerId: sales[i % sales.length]?.id ?? null, amount: o.amount, probability: stage.probability, expectedClose: days(o.close), closedAt: stage.isWon ? new Date() : null, position: i, createdById: userId } }));
  }
  await prisma.activity.createMany({ data: [
    { companyId, opportunityId: created[0].id, type: "MEETING", subject: "Requirements workshop", dueAt: days(3), assigneeId: userId, createdById: userId },
    { companyId, opportunityId: created[0].id, type: "CALL", subject: "Intro call", doneAt: days(-2), createdById: userId },
    { companyId, opportunityId: created[1].id, type: "EMAIL", subject: "Send revised proposal", dueAt: days(1), assigneeId: userId, createdById: userId },
    { companyId, leadId: leads[0].id, type: "CALL", subject: "Qualification call", dueAt: days(2), assigneeId: userId, createdById: userId },
  ] });

  // Quotations → order → confirm
  const line = (it: typeof items[number], qty: number, price?: number) => ({ itemId: it.id, descriptionAr: it.nameAr, descriptionEn: it.nameEn, quantity: qty, unitPrice: price ?? Number(it.salePrice), discountPct: 0, taxCodeId: vat15.id, accountId: it.revenueAccountId, costCenterId: null });
  const q1 = await saveQuotation(s, { customerId: customers[0].id, opportunityId: created[0].id, docDate: iso(days(-10)), dueDate: iso(days(20)), currencyCode: "SAR", exchangeRate: 1, discountPct: 5, reference: "RFQ-NK-21", salespersonId: sales[0]?.id, termsEn: "50% advance, 50% on delivery.", termsAr: "50% مقدم، 50% عند التسليم.", lines: [line(byCode("SRV-DEV"), 40), line(byCode("SRV-CONSULT"), 20), line(byCode("SRV-SUPPORT"), 3)] });
  await setQuotationStatus(s, q1.id, "SENT");
  const q2 = await saveQuotation(s, { customerId: customers[1].id, opportunityId: created[1].id, docDate: iso(days(-20)), dueDate: iso(days(10)), currencyCode: "SAR", exchangeRate: 1, discountPct: 0, salespersonId: sales[1]?.id, lines: [line(byCode("SRV-SUPPORT"), 12)] });
  await setQuotationStatus(s, q2.id, "SENT");
  await setQuotationStatus(s, q2.id, "ACCEPTED");
  const o = await convertQuotationToOrder(s, q2.id);
  await confirmOrder(s, o.id, true);
  await saveQuotation(s, { customerId: customers[2].id, opportunityId: created[2].id, docDate: iso(days(-3)), dueDate: iso(days(27)), currencyCode: "SAR", exchangeRate: 1, discountPct: 0, salespersonId: sales[0]?.id, lines: [line(byCode("SRV-AUDIT"), 1)] });

  // Portal user for customer 1
  await prisma.portalUser.upsert({ where: { email: "portal@nakheel.example" }, create: { companyId, customerId: customers[0].id, email: "portal@nakheel.example", name: "Ahmed Alsalem", locale: "ar", passwordHash: await bcrypt.hash("Portal@2026", 10) }, update: {} });
  console.log("  sales demo data created (portal login: portal@nakheel.example / Portal@2026)");
}
