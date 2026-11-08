/**
 * Finance demo transactions for the first seeded company. Runs through the real services
 * (posting engine, AR/AP, petty cash, assets, budgets) so the GL is consistent.
 * Idempotent: skipped when the company already has invoices.
 */
import { prisma } from "../src/lib/prisma";
import type { AppSession } from "../src/core/auth/session";
import { saveInvoice, postInvoice } from "../src/modules/finance/ar/invoices";
import { saveReceipt, postReceipt } from "../src/modules/finance/ar/receipts";
import { saveBill, postBill } from "../src/modules/finance/ap/bills";
import { savePayment, postPayment } from "../src/modules/finance/ap/payments";
import { saveJournalDraft, postJournalEntry, saveRecurring } from "../src/modules/finance/journals/service";
import { saveVoucher, postVoucher } from "../src/modules/finance/petty-cash/service";
import { saveAsset, runDepreciation } from "../src/modules/finance/assets/service";
import { saveBudget } from "../src/modules/finance/budgets/service";
import "../src/modules/finance/register";

function daysAgo(n: number) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  const jan1 = new Date(Date.UTC(new Date().getUTCFullYear(), 0, 1));
  return (d < jan1 ? jan1 : d).toISOString().slice(0, 10);
}

export async function seedFinance(companyId: string, userId: string) {
  const existing = await prisma.customerInvoice.count({ where: { companyId } });
  if (existing > 0) {
    console.log("  finance demo data already present — skipping");
    return;
  }
  const s = { userId, companyId, email: "seed", nameAr: "seed", nameEn: "seed", locale: "en", isSuperAdmin: true, companyIds: [companyId], branchId: null, permissions: new Set(["*"]) } as AppSession;
  const acc = async (code: string) => (await prisma.account.findFirstOrThrow({ where: { companyId, code } })).id;
  const customers = await prisma.customer.findMany({ where: { companyId }, orderBy: { code: "asc" } });
  const vendors = await prisma.vendor.findMany({ where: { companyId }, orderBy: { code: "asc" } });
  const items = await prisma.item.findMany({ where: { companyId }, orderBy: { code: "asc" } });
  const vat15 = await prisma.taxCode.findFirstOrThrow({ where: { companyId, code: "VAT15" } });
  const ccs = await prisma.costCenter.findMany({ where: { companyId } });
  const cc = (code: string) => ccs.find((c) => c.code === code)?.id ?? null;
  const fy = await prisma.fiscalYear.findFirstOrThrow({ where: { companyId }, orderBy: { startDate: "desc" } });

  // Bank account + petty cash fund
  const bank = await prisma.bankAccount.upsert({ where: { companyId_code: { companyId, code: "RAJHI" } }, create: { companyId, code: "RAJHI", nameAr: "الراجحي – الجاري", nameEn: "Al Rajhi – Current", bankName: "Al Rajhi Bank", iban: "SA0380000000608010167519", accountId: await acc("110201") }, update: {} });
  await prisma.pettyCashFund.upsert({ where: { companyId_code: { companyId, code: "PC-HQ" } }, create: { companyId, code: "PC-HQ", nameAr: "عهدة المقر الرئيسي", nameEn: "HQ petty cash", accountId: await acc("110102"), floatAmount: 5000 }, update: {} });
  const fund = await prisma.pettyCashFund.findFirstOrThrow({ where: { companyId, code: "PC-HQ" } });

  // Opening capital + bank balance
  const jv = await saveJournalDraft(s, { entryDate: daysAgo(80), description: "Opening capital", reference: "OPEN", currencyCode: "SAR", exchangeRate: 1, lines: [{ accountId: await acc("110201"), debit: 500000, credit: 0, description: "Bank" }, { accountId: await acc("110102"), debit: 5000, credit: 0, description: "Petty cash float" }, { accountId: await acc("310101"), debit: 0, credit: 505000, description: "Paid-up capital" }] });
  await postJournalEntry(s, jv.id);

  // Invoices
  const line = (it: typeof items[number], qty: number, ccCode: string) => ({ itemId: it.id, descriptionAr: it.nameAr, descriptionEn: it.nameEn, quantity: qty, unitPrice: Number(it.salePrice), discountPct: 0, taxCodeId: vat15.id, accountId: it.revenueAccountId, costCenterId: cc(ccCode) });
  const inv = async (ci: number, dateAgo: number, lines: ReturnType<typeof line>[], type: "STANDARD" | "SIMPLIFIED" = "STANDARD") => {
    const c = customers[ci];
    const i = await saveInvoice(s, { customerId: c.id, type, kind: "INVOICE", docDate: daysAgo(dateAgo), dueDate: daysAgo(Math.max(0, dateAgo - c.paymentTermsDays)), currencyCode: "SAR", exchangeRate: 1, discountPct: 0, lines });
    await postInvoice(s, i.id, { overrideCredit: true });
    return i;
  };
  const inv1 = await inv(0, 75, [line(items[0], 20, "SLS"), line(items[2], 1, "OPS")]);
  const inv2 = await inv(1, 60, [line(items[1], 10, "OPS")]);
  const inv3 = await inv(2, 40, [line(items[4], 1, "SLS"), line(items[5], 1, "IT")]);
  const inv4 = await inv(3, 20, [line(items[3], 3, "HR")]);
  await inv(4, 7, [line(items[6], 5, "SLS")], "SIMPLIFIED");
  await inv(5, 3, [line(items[8], 1, "IT")]);

  // Receipts: inv1 paid, inv2 paid, inv3 partially
  const rc = async (ci: number, dateAgo: number, amount: number, allocs: { invoiceId: string; amount: number }[]) => {
    const r = await saveReceipt(s, { customerId: customers[ci].id, receiptDate: daysAgo(dateAgo), method: "BANK_TRANSFER", bankAccountId: bank.id, currencyCode: "SAR", exchangeRate: 1, amount, reference: `TRF-${dateAgo}`, allocations: allocs });
    await postReceipt(s, r.id);
  };
  const full = async (id: string) => Number((await prisma.customerInvoice.findUniqueOrThrow({ where: { id } })).total);
  await rc(0, 50, await full(inv1.id), [{ invoiceId: inv1.id, amount: await full(inv1.id) }]);
  await rc(1, 30, await full(inv2.id), [{ invoiceId: inv2.id, amount: await full(inv2.id) }]);
  await rc(2, 10, 10000, [{ invoiceId: inv3.id, amount: 10000 }]);
  void inv4;

  // Bills
  const bl = (descAr: string, descEn: string, amount: number, accCode: string, ccCode: string) => ({ itemId: null, descriptionAr: descAr, descriptionEn: descEn, quantity: 1, unitPrice: amount, discountPct: 0, taxCodeId: vat15.id, accountId: null as string | null, costCenterId: cc(ccCode), _acc: accCode });
  const bill = async (vi: number, dateAgo: number, lines: ReturnType<typeof bl>[], vendorInvoiceNumber: string) => {
    const resolved = await Promise.all(lines.map(async (l) => ({ ...l, accountId: await acc(l._acc) })));
    const b = await saveBill(s, { vendorId: vendors[vi].id, vendorInvoiceNumber, docDate: daysAgo(dateAgo), dueDate: daysAgo(Math.max(0, dateAgo - 30)), currencyCode: "SAR", exchangeRate: 1, discountPct: 0, lines: resolved.map(({ _acc: _ignored, ...rest }) => { void _ignored; return rest; }) });
    await postBill(s, b.id);
    return b;
  };
  const b1 = await bill(5, 70, [bl("إيجار المكتب – الربع", "Office rent – quarter", 45000, "520201", "ADM")], "SBL-2026-11");
  const b2 = await bill(0, 35, [bl("اتصالات وإنترنت", "Telecom & internet", 3200, "520203", "IT")], "STC-88213");
  await bill(6, 15, [bl("تراخيص Microsoft 365", "Microsoft 365 licences", 12000, "520206", "IT")], "MS-INV-5511");
  await bill(3, 5, [bl("قرطاسية", "Stationery", 850, "520204", "ADM")], "RS-0045");
  const pay = async (vi: number, dateAgo: number, billId: string) => {
    const amount = Number((await prisma.vendorBill.findUniqueOrThrow({ where: { id: billId } })).total);
    const p = await savePayment(s, { vendorId: vendors[vi].id, paymentDate: daysAgo(dateAgo), method: "BANK_TRANSFER", bankAccountId: bank.id, currencyCode: "SAR", exchangeRate: 1, amount, reference: `PAY-${dateAgo}`, allocations: [{ billId, amount }] });
    await postPayment(s, p.id);
  };
  await pay(5, 55, b1.id);
  await pay(0, 20, b2.id);

  // Petty cash
  for (const [ago, desc, amt, accCode] of [[25, "Taxi & transport", 180, "520208"], [12, "Office refreshments", 240, "520204"], [4, "Courier", 95, "520208"]] as const) {
    const v = await saveVoucher(s, { fundId: fund.id, voucherDate: daysAgo(ago), type: "EXPENSE", description: desc, amount: amt, taxCodeId: vat15.id, expenseAccountId: await acc(accCode), costCenterId: cc("ADM"), vendorName: "Misc" });
    await postVoucher(s, v.id);
  }

  // Fixed assets
  const cat = await prisma.fixedAssetCategory.upsert({ where: { companyId_code: { companyId, code: "IT" } }, create: { companyId, code: "IT", nameAr: "أجهزة حاسب", nameEn: "Computer equipment", assetAccountId: await acc("120102"), accumDepAccountId: await acc("120201"), depExpenseAccountId: await acc("520301"), method: "STRAIGHT_LINE", lifeMonths: 36, rate: 33.33 }, update: {} });
  const catV = await prisma.fixedAssetCategory.upsert({ where: { companyId_code: { companyId, code: "VEH" } }, create: { companyId, code: "VEH", nameAr: "سيارات", nameEn: "Vehicles", assetAccountId: await acc("120103"), accumDepAccountId: await acc("120201"), depExpenseAccountId: await acc("520301"), method: "DECLINING_BALANCE", lifeMonths: 60, rate: 25 }, update: {} });
  await saveAsset(s, { categoryId: cat.id, nameAr: "خوادم المكتب", nameEn: "Office servers", serial: "SRV-001", location: "HQ", notes: null, acquisitionDate: daysAgo(90), depreciationStart: daysAgo(90), cost: 48000, salvage: 0, lifeMonths: 36, method: "STRAIGHT_LINE", rate: 0, costCenterId: cc("IT"), postAcquisition: true, creditAccountId: await acc("110201") });
  await saveAsset(s, { categoryId: catV.id, nameAr: "سيارة توصيل", nameEn: "Delivery van", serial: "VAN-001", location: "Riyadh", notes: null, acquisitionDate: daysAgo(90), depreciationStart: daysAgo(90), cost: 95000, salvage: 10000, lifeMonths: 60, method: "DECLINING_BALANCE", rate: 25, costCenterId: cc("OPS"), postAcquisition: true, creditAccountId: await acc("110201") });
  const prev = new Date();
  prev.setUTCMonth(prev.getUTCMonth() - 1);
  if (prev >= fy.startDate) await runDepreciation(companyId, userId, prev);

  // Recurring + budget
  await saveRecurring(s, { nameAr: "إيجار شهري", nameEn: "Monthly rent accrual", frequency: "MONTHLY", startDate: daysAgo(0), autoPost: false, isActive: true, lines: [{ accountId: await acc("520201"), debit: 15000, credit: 0, description: "Rent", costCenterId: cc("ADM") }, { accountId: await acc("210403"), debit: 0, credit: 15000, description: "Accrued rent" }] });
  await saveBudget(s, { fiscalYearId: fy.id, nameAr: `موازنة ${fy.code}`, nameEn: `Budget ${fy.code}`, lines: [
    { accountId: await acc("410101"), costCenterId: null, monthly: Array(12).fill(90000) },
    { accountId: await acc("520101"), costCenterId: null, monthly: Array(12).fill(55000) },
    { accountId: await acc("520201"), costCenterId: cc("ADM"), monthly: Array(12).fill(15000) },
    { accountId: await acc("520203"), costCenterId: cc("IT"), monthly: Array(12).fill(3500) },
    { accountId: await acc("520209"), costCenterId: cc("SLS"), monthly: Array(12).fill(8000) },
  ] });
  console.log("  finance demo transactions posted");
}
