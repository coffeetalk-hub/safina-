import { prisma } from "@/lib/prisma";
import { registerWidget, DEFAULT_LAYOUTS } from "@/core/dashboard/registry";

registerWidget({
  key: "openRequests",
  permission: "purchasing.request:view",
  load: async (s) => ({ kind: "stat", value: await prisma.purchaseRequest.count({ where: { companyId: s.companyId, status: { in: ["PENDING_APPROVAL", "APPROVED"] } } }), href: "/purchasing/requests?f.status=APPROVED" }),
});
registerWidget({
  key: "rfqsAwaitingQuotes",
  permission: "purchasing.rfq:view",
  load: async (s) => ({ kind: "stat", value: await prisma.rfq.count({ where: { companyId: s.companyId, status: { in: ["SENT", "QUOTED"] } } }), href: "/purchasing/rfq?f.status=SENT" }),
});
registerWidget({
  key: "posToBill",
  permission: "purchasing.order:view",
  load: async (s) => {
    const rows = await prisma.purchaseOrder.findMany({ where: { companyId: s.companyId, status: { in: ["APPROVED", "SENT", "PARTIALLY_BILLED"] } }, select: { total: true, exchangeRate: true, billedAmount: true } });
    return { kind: "stat", value: rows.reduce((a, r) => a + (Number(r.total) - Number(r.billedAmount)) * Number(r.exchangeRate), 0), format: "money", hint: `${rows.length}`, href: "/purchasing/orders?f.status=APPROVED" };
  },
});
registerWidget({
  key: "expiringContracts",
  permission: "purchasing.contract:view",
  load: async (s, locale) => {
    const rows = await prisma.vendorContract.findMany({ where: { companyId: s.companyId, status: "ACTIVE", endDate: { lte: new Date(Date.now() + 60 * 86_400_000) } }, orderBy: { endDate: "asc" }, take: 6, include: { vendor: { select: { nameAr: true, nameEn: true } } } });
    return { kind: "list", href: "/purchasing/contracts?f.expiring=true", items: rows.map((c) => ({ title: `${c.number} · ${locale === "ar" ? c.vendor.nameAr : c.vendor.nameEn}`, subtitle: c.endDate.toISOString().slice(0, 10), href: "/purchasing/contracts", badge: `${Math.ceil((c.endDate.getTime() - Date.now()) / 86_400_000)}d` })) };
  },
});
registerWidget({
  key: "purchasesByMonth",
  permission: "purchasing.report:view",
  size: 2,
  load: async (s, locale) => {
    const from = new Date(); from.setUTCMonth(from.getUTCMonth() - 5, 1); from.setUTCHours(0, 0, 0, 0);
    const rows = await prisma.vendorBill.findMany({ where: { companyId: s.companyId, status: { in: ["POSTED", "PARTIALLY_PAID", "PAID"] }, billDate: { gte: from } }, select: { billDate: true, baseTotal: true } });
    const m = new Map<string, number>();
    for (let i = 0; i < 6; i++) { const d = new Date(from); d.setUTCMonth(from.getUTCMonth() + i); m.set(d.toISOString().slice(0, 7), 0); }
    for (const r of rows) { const k = r.billDate.toISOString().slice(0, 7); m.set(k, (m.get(k) ?? 0) + Number(r.baseTotal)); }
    return { kind: "chart", type: "bar", xKey: "month", data: [...m.entries()].map(([month, total]) => ({ month, total: Math.round(total) })), series: [{ key: "total", label: locale === "ar" ? "المشتريات" : "Purchases" }] };
  },
});
registerWidget({
  key: "topVendors",
  permission: "purchasing.report:view",
  load: async (s, locale) => {
    const g = await prisma.vendorBill.groupBy({ by: ["vendorId"], where: { companyId: s.companyId, status: { in: ["POSTED", "PARTIALLY_PAID", "PAID"] } }, _sum: { baseTotal: true }, orderBy: { _sum: { baseTotal: "desc" } }, take: 5 });
    const vendors = await prisma.vendor.findMany({ where: { id: { in: g.map((x) => x.vendorId) } }, select: { id: true, nameAr: true, nameEn: true } });
    return { kind: "list", href: "/purchasing/reports", items: g.map((x) => { const v = vendors.find((y) => y.id === x.vendorId); return { title: locale === "ar" ? v?.nameAr ?? "" : v?.nameEn ?? "", subtitle: new Intl.NumberFormat(locale === "ar" ? "ar-SA-u-nu-latn" : "en-GB", { style: "currency", currency: "SAR" }).format(Number(x._sum.baseTotal ?? 0)), href: "/purchasing/reports" }; }) };
  },
});
DEFAULT_LAYOUTS.PURCHASING = ["openRequests", "rfqsAwaitingQuotes", "posToBill", "purchasesByMonth", "expiringContracts", "topVendors", "vendorsCount", "quickLinks"];
DEFAULT_LAYOUTS.ADMIN = [...DEFAULT_LAYOUTS.ADMIN.slice(0, 2), "posToBill", ...DEFAULT_LAYOUTS.ADMIN.slice(2)];
