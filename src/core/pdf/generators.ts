/** Central registration of document PDF generators (modules add theirs here). */
import { registerPdf } from "./registry";

registerPdf("invoice", () => import("@/modules/finance/pdf/generators").then((m) => m.invoicePdf));
registerPdf("bill", () => import("@/modules/finance/pdf/generators").then((m) => m.billPdf));
registerPdf("receipt", () => import("@/modules/finance/pdf/generators").then((m) => m.receiptPdf));
registerPdf("payment", () => import("@/modules/finance/pdf/generators").then((m) => m.paymentPdf));
registerPdf("journal", () => import("@/modules/finance/pdf/generators").then((m) => m.journalPdf));
registerPdf("quotation", () => import("@/modules/finance/pdf/generators").then((m) => m.quotationPdf));
registerPdf("sales-order", () => import("@/modules/finance/pdf/generators").then((m) => m.salesOrderPdf));
registerPdf("purchase-order", () => import("@/modules/purchasing/pdf").then((m) => m.purchaseOrderPdf));
registerPdf("payslip", () => import("@/modules/hr/pdf").then((m) => m.payslipPdf));
registerPdf("eosb", () => import("@/modules/hr/pdf").then((m) => m.eosbPdf));
