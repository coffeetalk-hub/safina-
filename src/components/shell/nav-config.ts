import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard, Building2, Calendar, Coins, Percent, Users, Shield, ScrollText, Hash, CheckSquare,
  BookOpen, Landmark, Target, UserSquare2, Package, Settings, Bell, Upload, GitBranch, Paperclip,
  BookText, Repeat, FileText, Receipt, FileInput, CreditCard, Wallet, Building, Boxes, FileSpreadsheet, PiggyBank, BarChart3,
  UserPlus, KanbanSquare, FileSignature, ShoppingCart, Tags, Globe, TrendingUp,
  ClipboardList, Scale, PackageCheck, FileBadge, Star, PieChart,
  IdCard, CalendarCheck, TreePalm, HandCoins, Banknote, LogOut, SlidersHorizontal, CircleUserRound, FileText as FileText2,
} from "lucide-react";

/** `permission`: any one of the listed keys shows the item. */
export type NavItem = { key: string; href: string; icon: LucideIcon; permission?: string | string[] };
export type NavGroup = { key: string; items: NavItem[] };

/** Sidebar structure. Modules 2–5 append their groups here. */
export const NAV: NavGroup[] = [
  {
    key: "general",
    items: [
      { key: "dashboard", href: "/dashboard", icon: LayoutDashboard },
      { key: "approvals", href: "/approvals", icon: CheckSquare },
      { key: "notifications", href: "/notifications", icon: Bell },
    ],
  },
  {
    key: "sales",
    items: [
      { key: "leads", href: "/sales/leads", icon: UserPlus, permission: "sales.lead:view" },
      { key: "pipeline", href: "/sales/pipeline", icon: KanbanSquare, permission: "sales.opportunity:view" },
      { key: "quotations", href: "/sales/quotations", icon: FileSignature, permission: "sales.quotation:view" },
      { key: "salesOrders", href: "/sales/orders", icon: ShoppingCart, permission: "sales.order:view" },
      { key: "priceLists", href: "/sales/price-lists", icon: Tags, permission: "sales.priceList:view" },
      { key: "portalUsers", href: "/sales/portal-users", icon: Globe, permission: "sales.portal:view" },
      { key: "salesReports", href: "/sales/reports", icon: TrendingUp, permission: "sales.report:view" },
    ],
  },
  {
    key: "purchasing",
    items: [
      { key: "purchaseRequests", href: "/purchasing/requests", icon: ClipboardList, permission: ["purchasing.request:view", "purchasing.myRequest:view"] },
      { key: "rfq", href: "/purchasing/rfq", icon: Scale, permission: "purchasing.rfq:view" },
      { key: "purchaseOrders", href: "/purchasing/orders", icon: PackageCheck, permission: "purchasing.order:view" },
      { key: "contracts", href: "/purchasing/contracts", icon: FileBadge, permission: "purchasing.contract:view" },
      { key: "evaluations", href: "/purchasing/evaluations", icon: Star, permission: "purchasing.evaluation:view" },
      { key: "purchasingReports", href: "/purchasing/reports", icon: PieChart, permission: "purchasing.report:view" },
    ],
  },
  {
    key: "hr",
    items: [
      { key: "mySelfService", href: "/hr/self", icon: CircleUserRound, permission: "hr.self:view" },
      { key: "hrEmployees", href: "/hr/employees", icon: IdCard, permission: "hr.employee:view" },
      { key: "attendance", href: "/hr/attendance", icon: CalendarCheck, permission: "hr.attendance:view" },
      { key: "leave", href: "/hr/leave", icon: TreePalm, permission: "hr.leave:view" },
      { key: "payroll", href: "/hr/payroll", icon: Banknote, permission: "hr.payroll:view" },
      { key: "loans", href: "/hr/loans", icon: HandCoins, permission: "hr.loan:view" },
      { key: "eosb", href: "/hr/eosb", icon: LogOut, permission: "hr.eosb:view" },
      { key: "hrDocuments", href: "/hr/documents", icon: FileText2, permission: "hr.document:view" },
      { key: "hrSettings", href: "/hr/settings", icon: SlidersHorizontal, permission: "hr.payroll:edit" },
      { key: "hrReports", href: "/hr/reports", icon: PieChart, permission: "hr.report:view" },
    ],
  },
  {
    key: "finance",
    items: [
      { key: "journals", href: "/finance/journals", icon: BookText, permission: "finance.journal:view" },
      { key: "recurring", href: "/finance/recurring", icon: Repeat, permission: "finance.recurring:view" },
      { key: "invoices", href: "/finance/ar/invoices", icon: FileText, permission: "finance.invoice:view" },
      { key: "receipts", href: "/finance/ar/receipts", icon: Receipt, permission: "finance.receipt:view" },
      { key: "arAging", href: "/finance/ar/aging", icon: BarChart3, permission: "finance.report:view" },
      { key: "bills", href: "/finance/ap/bills", icon: FileInput, permission: "finance.bill:view" },
      { key: "payments", href: "/finance/ap/payments", icon: CreditCard, permission: "finance.payment:view" },
      { key: "apAging", href: "/finance/ap/aging", icon: BarChart3, permission: "finance.report:view" },
      { key: "bank", href: "/finance/bank", icon: Building, permission: "finance.bank:view" },
      { key: "pettyCash", href: "/finance/petty-cash", icon: Wallet, permission: "finance.pettyCash:view" },
      { key: "assets", href: "/finance/assets", icon: Boxes, permission: "finance.asset:view" },
      { key: "vat", href: "/finance/vat", icon: FileSpreadsheet, permission: "finance.vat:view" },
      { key: "budgets", href: "/finance/budgets", icon: PiggyBank, permission: "finance.budget:view" },
      { key: "trialBalance", href: "/finance/reports/trial-balance", icon: BarChart3, permission: "finance.report:view" },
      { key: "profitLoss", href: "/finance/reports/profit-loss", icon: BarChart3, permission: "finance.report:view" },
      { key: "balanceSheet", href: "/finance/reports/balance-sheet", icon: BarChart3, permission: "finance.report:view" },
      { key: "cashFlow", href: "/finance/reports/cash-flow", icon: BarChart3, permission: "finance.report:view" },
      { key: "ledger", href: "/finance/reports/ledger", icon: BookOpen, permission: "finance.report:view" },
    ],
  },
  {
    key: "masterData",
    items: [
      { key: "accounts", href: "/foundation/accounts", icon: BookOpen, permission: "foundation.account:view" },
      { key: "costCenters", href: "/foundation/cost-centers", icon: Target, permission: "foundation.costCenter:view" },
      { key: "customers", href: "/foundation/customers", icon: Users, permission: "foundation.customer:view" },
      { key: "vendors", href: "/foundation/vendors", icon: Landmark, permission: "foundation.vendor:view" },
      { key: "items", href: "/foundation/items", icon: Package, permission: "foundation.item:view" },
      { key: "employees", href: "/foundation/employees", icon: UserSquare2, permission: "foundation.employee:view" },
      { key: "import", href: "/foundation/import", icon: Upload, permission: "foundation.import:view" },
    ],
  },
  {
    key: "administration",
    items: [
      { key: "companies", href: "/foundation/companies", icon: Building2, permission: "foundation.company:view" },
      { key: "branches", href: "/foundation/branches", icon: GitBranch, permission: "foundation.branch:view" },
      { key: "fiscal", href: "/foundation/fiscal", icon: Calendar, permission: "foundation.fiscal:view" },
      { key: "currencies", href: "/foundation/currencies", icon: Coins, permission: "foundation.currency:view" },
      { key: "taxes", href: "/foundation/taxes", icon: Percent, permission: "foundation.tax:view" },
      { key: "users", href: "/foundation/users", icon: Users, permission: "foundation.user:view" },
      { key: "roles", href: "/foundation/roles", icon: Shield, permission: "foundation.role:view" },
      { key: "numbering", href: "/foundation/numbering", icon: Hash, permission: "foundation.numbering:view" },
      { key: "approvalPolicies", href: "/foundation/approval-policies", icon: CheckSquare, permission: "foundation.approval:view" },
      { key: "attachments", href: "/foundation/attachments", icon: Paperclip, permission: "foundation.attachment:view" },
      { key: "audit", href: "/foundation/audit", icon: ScrollText, permission: "foundation.audit:view" },
      { key: "settings", href: "/foundation/settings", icon: Settings, permission: "foundation.settings:view" },
    ],
  },
];
