/**
 * Central registration of Excel exporters. Each module registers its list resources here.
 * Loaders are lazy so this file stays cheap to import.
 */
import { registerExporter } from "./registry";

registerExporter("customers", () => import("@/modules/foundation/customers/exporter").then((m) => m.exporter));
registerExporter("vendors", () => import("@/modules/foundation/vendors/exporter").then((m) => m.exporter));
registerExporter("items", () => import("@/modules/foundation/items/exporter").then((m) => m.exporter));
registerExporter("employees", () => import("@/modules/foundation/employees/exporter").then((m) => m.exporter));
registerExporter("accounts", () => import("@/modules/foundation/accounts/exporter").then((m) => m.exporter));
registerExporter("cost-centers", () => import("@/modules/foundation/cost-centers/exporter").then((m) => m.exporter));
registerExporter("audit", () => import("@/modules/foundation/audit/exporter").then((m) => m.exporter));
registerExporter("users", () => import("@/modules/foundation/users/exporter").then((m) => m.exporter));
registerExporter("branches", () => import("@/modules/foundation/branches/exporter").then((m) => m.exporter));
registerExporter("taxes", () => import("@/modules/foundation/taxes/exporter").then((m) => m.exporter));

// Finance
registerExporter("journals", () => import("@/modules/finance/exporters").then((m) => m.journals));
registerExporter("invoices", () => import("@/modules/finance/exporters").then((m) => m.invoices));
registerExporter("receipts", () => import("@/modules/finance/exporters").then((m) => m.receipts));
registerExporter("bills", () => import("@/modules/finance/exporters").then((m) => m.bills));
registerExporter("payments", () => import("@/modules/finance/exporters").then((m) => m.payments));
registerExporter("ar-aging", () => import("@/modules/finance/exporters").then((m) => m.arAgingExporter));
registerExporter("ap-aging", () => import("@/modules/finance/exporters").then((m) => m.apAgingExporter));
registerExporter("assets", () => import("@/modules/finance/exporters").then((m) => m.assets));
registerExporter("petty-cash", () => import("@/modules/finance/exporters").then((m) => m.pettyCash));
registerExporter("trial-balance", () => import("@/modules/finance/exporters").then((m) => m.trialBalanceExporter));
registerExporter("profit-loss", () => import("@/modules/finance/exporters").then((m) => m.profitLossExporter));
registerExporter("balance-sheet", () => import("@/modules/finance/exporters").then((m) => m.balanceSheetExporter));
registerExporter("ledger", () => import("@/modules/finance/exporters").then((m) => m.ledgerExporter));

// Sales & CRM
registerExporter("leads", () => import("@/modules/sales/exporters").then((m) => m.leadsExporter));
registerExporter("quotations", () => import("@/modules/sales/exporters").then((m) => m.quotations));
registerExporter("sales-orders", () => import("@/modules/sales/exporters").then((m) => m.salesOrders));
registerExporter("sales-by-customer", () => import("@/modules/sales/exporters").then((m) => m.byCustomer));
registerExporter("sales-by-salesperson", () => import("@/modules/sales/exporters").then((m) => m.bySalesperson));
registerExporter("sales-by-item", () => import("@/modules/sales/exporters").then((m) => m.byItem));
registerExporter("sales-by-period", () => import("@/modules/sales/exporters").then((m) => m.byPeriod));
registerExporter("purchase-requests", () => import("@/modules/purchasing/exporters").then((m) => m.requests));
registerExporter("rfqs", () => import("@/modules/purchasing/exporters").then((m) => m.rfqs));
registerExporter("purchase-orders", () => import("@/modules/purchasing/exporters").then((m) => m.purchaseOrders));
registerExporter("vendor-contracts", () => import("@/modules/purchasing/exporters").then((m) => m.vendorContracts));
registerExporter("vendor-evaluations", () => import("@/modules/purchasing/exporters").then((m) => m.vendorEvaluations));
registerExporter("purchases-by-vendor", () => import("@/modules/purchasing/exporters").then((m) => m.byVendor));
registerExporter("purchases-by-item", () => import("@/modules/purchasing/exporters").then((m) => m.byItem));
registerExporter("purchases-by-period", () => import("@/modules/purchasing/exporters").then((m) => m.byPeriod));
registerExporter("purchasing-pending-approvals", () => import("@/modules/purchasing/exporters").then((m) => m.pendingApprovals));
registerExporter("hr-contracts", () => import("@/modules/hr/exporters").then((m) => m.contractsX));
registerExporter("hr-documents", () => import("@/modules/hr/exporters").then((m) => m.documentsX));
registerExporter("hr-attendance", () => import("@/modules/hr/exporters").then((m) => m.attendanceX));
registerExporter("hr-leave", () => import("@/modules/hr/exporters").then((m) => m.leaveX));
registerExporter("hr-loans", () => import("@/modules/hr/exporters").then((m) => m.loansX));
registerExporter("hr-payroll-runs", () => import("@/modules/hr/exporters").then((m) => m.runsX));
registerExporter("hr-payslips", () => import("@/modules/hr/exporters").then((m) => m.payslipsX));
registerExporter("hr-eosb", () => import("@/modules/hr/exporters").then((m) => m.eosX));
registerExporter("hr-gosi-rates", () => import("@/modules/hr/exporters").then((m) => m.gosiRatesX));
registerExporter("hr-holidays", () => import("@/modules/hr/exporters").then((m) => m.holidaysX));
registerExporter("hr-pay-components", () => import("@/modules/hr/exporters").then((m) => m.payComponentsX));
registerExporter("hr-leave-types", () => import("@/modules/hr/exporters").then((m) => m.leaveTypesX));
registerExporter("hr-headcount", () => import("@/modules/hr/exporters").then((m) => m.headcountX));
registerExporter("hr-payroll-by-month", () => import("@/modules/hr/exporters").then((m) => m.payrollMonthX));
registerExporter("hr-payroll-by-cost-center", () => import("@/modules/hr/exporters").then((m) => m.payrollCcX));
registerExporter("hr-gosi-summary", () => import("@/modules/hr/exporters").then((m) => m.gosiX));
registerExporter("hr-leave-summary", () => import("@/modules/hr/exporters").then((m) => m.leaveSummaryX));
registerExporter("hr-expiring", () => import("@/modules/hr/exporters").then((m) => m.expiringX));
