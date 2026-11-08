import { prisma } from "@/lib/prisma";
import { registerWidget, DEFAULT_LAYOUTS } from "@/core/dashboard/registry";
import { D } from "@/lib/money";
import { profitLoss, cashFlow } from "./reports/service";
import { yearRange } from "./_shared/page-helpers";

registerWidget({
  key: "arOutstanding",
  permission: "finance.invoice:view",
  load: async (s) => {
    const r = await prisma.customerInvoice.aggregate({ where: { companyId: s.companyId, status: { in: ["POSTED", "PARTIALLY_PAID"] } }, _sum: { baseTotal: true, paidAmount: true } });
    return { kind: "stat", value: D(r._sum.baseTotal ?? 0).minus(D(r._sum.paidAmount ?? 0)).toNumber(), format: "money", href: "/finance/ar/aging" };
  },
});
registerWidget({
  key: "apOutstanding",
  permission: "finance.bill:view",
  load: async (s) => {
    const r = await prisma.vendorBill.aggregate({ where: { companyId: s.companyId, status: { in: ["POSTED", "PARTIALLY_PAID"] } }, _sum: { baseTotal: true, paidAmount: true } });
    return { kind: "stat", value: D(r._sum.baseTotal ?? 0).minus(D(r._sum.paidAmount ?? 0)).toNumber(), format: "money", href: "/finance/ap/aging" };
  },
});
registerWidget({
  key: "cashBalance",
  permission: "finance.bank:view",
  load: async (s) => {
    const y = yearRange();
    const cf = await cashFlow(s, { from: new Date(y.from), to: new Date() });
    return { kind: "stat", value: cf.closing, format: "money", href: "/finance/bank" };
  },
});
registerWidget({
  key: "netIncomeYtd",
  permission: "finance.report:view",
  load: async (s) => {
    const y = yearRange();
    const pl = await profitLoss(s, { from: new Date(y.from), to: new Date() });
    return { kind: "stat", value: pl.netIncome, format: "money", href: "/finance/reports/profit-loss" };
  },
});
registerWidget({
  key: "revenueByMonth",
  permission: "finance.report:view",
  size: 2,
  load: async (s) => {
    const y = new Date().getUTCFullYear();
    const rows = await prisma.journalLine.findMany({ where: { companyId: s.companyId, account: { type: "REVENUE" }, entry: { status: "POSTED", entryDate: { gte: new Date(Date.UTC(y, 0, 1)) } } }, select: { baseDebit: true, baseCredit: true, entry: { select: { entryDate: true } } } });
    const exp = await prisma.journalLine.findMany({ where: { companyId: s.companyId, account: { type: "EXPENSE" }, entry: { status: "POSTED", entryDate: { gte: new Date(Date.UTC(y, 0, 1)) } } }, select: { baseDebit: true, baseCredit: true, entry: { select: { entryDate: true } } } });
    const data = Array.from({ length: 12 }, (_, i) => ({ month: `${String(i + 1).padStart(2, "0")}`, revenue: 0, expenses: 0 }));
    for (const r of rows) data[r.entry.entryDate.getUTCMonth()].revenue += Number(r.baseCredit) - Number(r.baseDebit);
    for (const r of exp) data[r.entry.entryDate.getUTCMonth()].expenses += Number(r.baseDebit) - Number(r.baseCredit);
    return { kind: "chart", type: "bar", data, xKey: "month", series: [{ key: "revenue", label: "Revenue" }, { key: "expenses", label: "Expenses" }] };
  },
});
registerWidget({
  key: "overdueInvoices",
  permission: "finance.invoice:view",
  load: async (s, locale) => {
    const rows = await prisma.customerInvoice.findMany({ where: { companyId: s.companyId, status: { in: ["POSTED", "PARTIALLY_PAID"] }, dueDate: { lt: new Date() } }, orderBy: { dueDate: "asc" }, take: 6, include: { customer: { select: { nameAr: true, nameEn: true } } } });
    return { kind: "list", href: "/finance/ar/invoices?f.overdue=true", items: rows.map((r) => ({ title: `${r.number} · ${locale === "ar" ? r.customer.nameAr : r.customer.nameEn}`, subtitle: r.dueDate.toISOString().slice(0, 10), href: `/finance/ar/invoices/${r.id}`, badge: D(r.total).minus(r.paidAmount).toFixed(2) })) };
  },
});

DEFAULT_LAYOUTS.ADMIN = ["pendingApprovals", "arOutstanding", "apOutstanding", "cashBalance", "netIncomeYtd", "revenueByMonth", "overdueInvoices", "customersCount", "vendorsCount", "employeesCount", "recentAudit", "quickLinks"];
DEFAULT_LAYOUTS.ACCOUNTANT = ["pendingApprovals", "arOutstanding", "apOutstanding", "cashBalance", "revenueByMonth", "overdueInvoices", "quickLinks"];
DEFAULT_LAYOUTS.FINANCE_MANAGER = ["pendingApprovals", "arOutstanding", "apOutstanding", "cashBalance", "netIncomeYtd", "revenueByMonth", "overdueInvoices", "quickLinks"];
