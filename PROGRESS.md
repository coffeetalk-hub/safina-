# PROGRESS — Safina ERP

Legend: ✅ done · 🔄 in progress · ⬜ not started · ⚠️ needs your input

## Module 1 — Foundation ✅ (built; awaiting your test pass)

### Platform
- ✅ Next.js 16 (App Router) + TypeScript + Tailwind v4 + hand-vendored shadcn/ui components (registry host blocked in sandbox)
- ✅ Prisma 6 schema + initial migration (`prisma/migrations/20261103000000_init`)
- ✅ NextAuth v5 credentials login, lockout after 5 failures, JWT sessions
- ✅ next-intl `ar` (default, RTL) / `en`, bilingual message files, locale switch, local IBM Plex Sans Arabic font
- ✅ Multi-company: company switcher, cookie-scoped active company, users see only assigned companies
- ✅ RBAC: `module.resource:action` permission catalogue, role templates (ADMIN, ACCOUNTANT, FINANCE_MANAGER, SALES, PURCHASING, HR, EMPLOYEE, APPROVER), role ↔ user per company
- ✅ Soft delete everywhere (Prisma extension), nothing hard-deleted
- ✅ Audit log (Prisma extension): who/what/when, before → after, field diff; viewer with filters + export
- ✅ Document numbering (configurable prefix/pattern/reset, row-locked, gap-free)
- ✅ Approval engine: policies by docType + amount band, multi-step (role or user), inbox “My approvals”, hooks for modules
- ✅ Attachments on any entity (local disk storage behind interface), panel component + download route
- ✅ In-app notifications (bell + page) + email outbox with SMTP flush via cron route
- ✅ Dashboard framework: widget registry, role-based layouts, stat/list/chart/links widget types (Recharts)
- ✅ Settings: logo upload, invoice template options, footer/terms (AR/EN), bank details, QR toggle
- ✅ Generic DataTable: search, filters, sort, pagination, column visibility (persisted), Excel export, Print PDF — on every list
- ✅ PDF base: company header, bilingual title, footer/page numbers; list-report generator; document PDF registry
- ✅ Excel import tool with downloadable templates: customers, vendors, items, employees, chart of accounts, opening balances (validated; posting hooks into Finance)
- ✅ Cron routes: `/api/cron/email` (+ registry for later jobs), protected by `CRON_SECRET`
- ✅ Seed: 2 companies, full Saudi SME COA + control-account mappings, 10 customers, 10 vendors, 10 items, 15 employees, cost centers, branches, currencies/rates, approval policies, 6 users
- ✅ Unit tests (vitest): money/VAT math, numbering patterns, RBAC catalogue, table helpers

### Master data screens
- ✅ Companies · Branches · Fiscal years & periods (open/close/lock) · Currencies & exchange rates · Tax codes
- ✅ Users (roles per company, super-admin company assignment, password reset) · Roles & permission matrix
- ✅ Chart of accounts (tree, control-account mappings tab) · Cost centers · Customers · Vendors · Items/services · Employees
- ✅ Numbering · Approval policies · Attachments · Audit log · Notifications · My approvals · Profile (change password)

### Verified at runtime (sandbox PostgreSQL 16 + Playwright, 31/31 checks)
- ✅ migrate → seed → login (AR/EN), dashboard widgets, customers CRUD + search/filter/sort, audit diff, Excel export, PDF print (Arabic shaping verified), import template, all 13 foundation pages, company switch isolation, 403 page for unauthorised role, mobile layout without horizontal scroll

## Module 2 — Finance & accounting ✅ (built; awaiting your test pass)

### Core
- ✅ Posting engine (`src/core/posting`): the only writer of journal lines — validates postable accounts, cost centers, open period, balance (base-currency rounding line), numbers entries, audit trail; reversal instead of edit
- ✅ Manual journals (editor with lines/cost centers/multi-currency), post → approval policy aware, reverse, delete draft, PDF voucher
- ✅ Recurring journals (weekly/monthly/quarterly/yearly, draft or auto-post, "run now" + cron `recurring-journals`)
- ✅ Control-account mappings used everywhere (AR, AP, VAT in/out, revenue, expense, bank, cash, rounding, VAT payable, other income/expense…)

### AR / AP
- ✅ Customer invoices: standard/simplified, invoice/credit/debit note, lines with items, line + header discounts, tax codes, revenue account & cost center per line, header currency/rate, salesperson
- ✅ Credit-limit blocking on post (override for users with `finance.invoice:approve`), approval workflow, cancel, reverse, one-click credit note (auto-applies to original)
- ✅ Receipts with allocations (auto-allocate), posting Dr bank/cash Cr AR, invoice status PAID/PARTIALLY_PAID, reversal restores
- ✅ Vendor bills (expense/VAT-input posting), payments with allocations, approval hooks
- ✅ AR & AP aging (current / 1–30 / 31–60 / 61–90 / 90+) with Excel + PDF; customer statement service (used by portal in Module 3)
- ✅ PDFs: bilingual tax invoice with ZATCA QR, credit note, vendor bill, receipt/payment vouchers, journal voucher

### ZATCA Phase 2 readiness (`src/core/zatca`)
- ✅ UUID, ICV counter, PIH hash chain (genesis = base64(sha256("0"))), SHA-256 invoice hash, TLV Base64 QR tags 1–9, UBL 2.1 XML (standard/simplified, 388/381/383), stored per invoice
- ✅ `ZatcaClient` interface with `StubZatcaClient`; "Submit to ZATCA" button stores the response; QR PNG and XML download routes
- ⚠️ Real signing (ECDSA + CSID certificate) and clearance/reporting API calls are intentionally not implemented — plug a real client into `getZatcaClient()`

### Bank, cash, assets, VAT, budgets
- ✅ Bank accounts (GL-linked), statement import (xlsx/csv + template), reconciliation workbench (match/unmatch/auto-match ±5 days, complete & lock), history
- ✅ Petty cash funds (custodian, float) and vouchers (expense with VAT / replenishment), posting, reversal
- ✅ Fixed assets: categories (accounts per category), register, optional acquisition entry, straight-line & declining-balance, monthly depreciation run (manual + cron `depreciation`), disposal with gain/loss, projected schedule
- ✅ VAT return in ZATCA box layout (standard/zero/exempt sales & purchases, output/input, net), save & file (posts settlement to VAT payable)
- ✅ Budgets by account × cost center × 12 months, approve/reopen, budget-vs-actual variance report
- ✅ Statements: trial balance (opening/movement/closing), P&L, balance sheet (with current earnings), cash flow (operating/investing/financing), general ledger — all filterable by period, branch, cost center; Excel + PDF
- ✅ Dashboard widgets: AR/AP outstanding, cash & bank, net income YTD, revenue vs expenses chart, overdue invoices
- ✅ Seed: opening capital, 6 invoices (incl. simplified), 3 receipts, 4 bills, 2 payments, 3 petty-cash vouchers, 2 assets with depreciation, recurring template, budget — GL balances to 0.00

### Verified at runtime (sandbox PostgreSQL 16 + Playwright, 52/52 checks)
- ✅ Create invoice in UI → post → ZATCA block (QR PNG, UBL XML, hash) → PDF; receipt auto-allocation → invoice PAID; manual journal post + reverse; bill post; every finance list/report exports Excel + PDF; trial balance & balance sheet balanced before and after UI transactions; cron routes

## Module 3 — Sales & CRM ✅ (built; awaiting your test pass)

- ✅ Leads (owner, source, status) with activities; one-click **convert** → customer + opportunity
- ✅ Pipeline **kanban** (dnd-kit drag between stages, per-owner filter, stage editor with probability / won / lost), opportunity page with activities (call/meeting/email/task/note, assignee notifications, done toggle) and linked quotations
- ✅ Quotations (reuse of the document editor: items, line + header discounts, tax, validity, terms) with status flow Draft → Sent → Accepted/Rejected/Expired → **Converted**; PDF
- ✅ Sales orders (customer PO, delivery date) with **credit-limit blocking** on confirm (override for `sales.order:approve`), approval-policy aware; PDF
- ✅ One-click chain: quotation → sales order → customer invoice (→ receipts in Finance); invoices link back to the order, orders show their invoices
- ✅ Price lists (quantity tiers, validity, default list) + customer-specific prices; resolution: customer price → customer's list → default list → item price; applied live in the editor
- ✅ Customer portal (`/portal`): separate auth realm (PortalUser), invoices with PDF download, outstanding/overdue, year-to-date statement; staff and portal sessions are isolated both ways
- ✅ Sales reports: by customer, salesperson, item, period (chart) — Excel + PDF
- ✅ Dashboard widgets: weighted pipeline, quotations awaiting reply, orders to invoice, pipeline by stage, my open activities
- ✅ Seed: stages, 4 leads (1 converted), 5 opportunities with activities, 3 quotations (1 sent, 1 accepted → confirmed order), wholesale price list + customer price, portal user `portal@nakheel.example` / `Portal@2026`

### Verified at runtime (36/36 checks)
- ✅ Kanban drag persists stage, lead → opportunity, customer-specific price resolved in editor, quotation → order → invoice → posted, credit-limit block + override, all exports/prints, portal login/PDF/isolation (403/404/401 cases)
## Module 4 — Purchasing ✅ (built; awaiting your test pass)

- ✅ **Purchase requests**: lines (item/description/qty/unit/estimated price/expense account/cost center), priority, requester, needed-by; submit → approval policy `PURCHASE_REQUEST` or auto-approve; cancel/delete; linked RFQs & POs; attachments
- ✅ **RFQ & vendor comparison**: create from an approved request (pick vendors) or standalone; invite vendors, mark sent, enter each vendor's quote (prices per line, ref, validity, lead time, payment terms, currency); **comparison board** highlights the lowest price per line, totals, rank #1, "lowest on lines" count; **Award** → draft purchase order from the winning quote, request marked Ordered
- ✅ **Purchase orders** (DocEditor "PO" mode, vendor party, expense accounts, VAT): confirm → approval policy `PURCHASE_ORDER` (seed: > 10,000 → Finance manager then Admin) or Approved; mark sent; **one-click vendor bill** (→ Finance AP, PO Billed); cancel; PDF "Purchase Order / أمر شراء"; new PO from a request pre-fills lines
- ✅ **Vendor contracts**: value, dates, alert window, auto-renew, owner, bilingual terms, auto-number `CTR-`; "expiring within 60 days" filter; cron `expiry-alerts` marks expired contracts and notifies users holding `purchasing.contract:edit` (in-app + email outbox, once per day)
- ✅ **Vendor evaluation**: 1–5 on quality/delivery/price/service/compliance, weighted score /100 (30/25/20/15/10), vendor scorecard (avg score, evaluations, bills, spend)
- ✅ **Reports**: purchases by vendor / item / period (chart) + pending purchasing approvals (deep links) — Excel + PDF for every list and report
- ✅ Dashboard widgets: open requests, RFQs awaiting quotes, POs to bill, purchases by month, expiring contracts, top vendors (PURCHASING role layout)
- ✅ Seed: 3 requests, RFQ with 3 vendor quotes → awarded → draft PO, PO → sent → draft bill, PO > 10,000 pending approval, 3 contracts (one expiring in 25 days, one expired), 5 evaluations
- ✅ Unit tests: weighted score, RFQ comparison ranking

### Verified at runtime (56/56 checks)
- ✅ Request → submit → RFQ (2 vendors) → quotes → comparison (#1 = lowest) → award → PO → confirm → sent → PDF → vendor bill; request/RFQ/PO statuses chained; large PO blocked by policy and approved in two inboxes (finance manager, admin); PO from request pre-fill; contracts expiring filter + cron + notification; evaluation score; reports; all 9 Excel/PDF exports; purchasing-role dashboard, 403 on finance, mobile layout. Finance 52/52 and Sales 36/36 regressions still pass.

## Module 5 — HR & payroll ✅ (built; awaiting your test pass)

- ✅ **Employee file** (`/hr/employees/[id]`, tabs): overview, contracts (unlimited / fixed-term / part-time, probation, notice, auto-number `EC-`), documents (Iqama, passport, insurance, work permit… with expiry + alert window), **salary structure** (basic + configurable earnings/deductions, % of basic or fixed, housing flag), leave balances (carry-over / adjustment), loans, payslips (PDF), end of service, attachments
- ✅ **HR settings — rules are data, not code**: work schedule, grace, weekend days, overtime multiplier (Art. 107), days-per-month divisor, annual leave 21 → 30 after 5 years (Art. 109), sick-leave tiers 30 / 60 @75 % / 30 unpaid (Art. 117), GOSI & EOSB wage basis, GOSI floor/cap, WPS establishment id; **effective-dated GOSI rate table** (seed: Saudi 9 % + 9 % pension, 0.75 % + 0.75 % SANED, 2 % hazards; non-Saudi 2 % hazards); pay components; leave types; public holidays
- ✅ **Attendance**: records with check-in/out → late / early / worked / overtime derived from the schedule (break = schedule span − daily hours); "Fill month" generator (weekends, holidays, approved leave, present); feeds payroll (absences, overtime)
- ✅ **Leave**: requests with calendar-day count, overlap and balance checks, max days per type; submit → `LEAVE` approval policy (seed: HR role) or HR direct approve/reject; approval updates balances and writes LEAVE attendance days; cancel restores; yearly balances auto-created from service length (pro-rata hire year); balances page
- ✅ **Loans & advances**: schedule, `LOAN` approval policy, disbursement journal (Dr Employee loans / Cr Bank), automatic monthly deduction in payroll, settlement on EOSB
- ✅ **Payroll**: run per month (optionally per branch) → **calculate** (pro-rata joiners/leavers, fixed earnings, overtime pay, absence + unpaid-leave + partial-sick deductions, GOSI employee/employer on capped basic+housing, loan installments, fixed deductions) → submit (`PAYROLL` policy) → **post** (Dr Salaries expense per cost center, Dr GOSI expense, Cr GOSI payable, Cr Employee loans, Cr deduction accounts, Cr Salaries payable) → **pay** (Dr Salaries payable / Cr Bank + Cash) → **WPS file** (CSV, generic SAMA/WPS field set, download route); payslip page + bilingual PDF; payroll register PDF/Excel
- ✅ **End of service**: calculator per Art. 84/85 (½ month per year ≤ 5, full month after; resignation 0 / ⅓ / ⅔ / full), leave encashment per Art. 111, loan balance netting, other additions/deductions → approve → post (expense, payable, loans; employee → TERMINATED) → pay; bilingual statement PDF
- ✅ **Self-service** (`/hr/self`, EMPLOYEE role): balances, own leave requests (file / submit / cancel), own attendance, own payslips with PDF, own documents and loans; list pages auto-scope to the signed-in employee
- ✅ Reports: headcount & Saudization by department, payroll by month (chart) and by cost center, GOSI summary, leave summary, expiring documents/contracts — Excel + PDF everywhere (18 exporters)
- ✅ Cron `document-alerts` (HR users + the employee, daily); dashboard widgets: pending leave, on leave today, expiring documents (replaces placeholder), Saudization, payroll cost chart, my leave balance (EMPLOYEE layout)
- ✅ Seed: defaults, 15 contracts + salary structures (4,500–25,000 basic), documents incl. expiring/expired Iqama, holidays, 2 months attendance with absences/overtime, approved/pending/draft leave, active loan, **previous month payroll posted & paid + WPS**, current month calculated, draft EOSB
- ✅ Unit tests: GOSI (cap/floor, Saudi vs non-Saudi), EOSB tiers, sick-pay tiers, annual entitlement, overtime, attendance metrics

### Verified at runtime (83/83 checks)
- ✅ All 13 HR pages AR/EN; employee file tabs + document add; employee self-service files leave → pending → HR approves from inbox → balance & attendance updated; HR direct reject; fill month; payroll run calculate → approve → post (journal) → pay (payment journal) → WPS CSV (14 bank rows) → payslip page + PDF; trial balance balanced after payroll; loan create → approve → disburse (journal); EOSB preview/save/PDF/cancel; settings + GOSI rates; reports incl. expiring; 18 Excel/PDF exports; cron document-alerts + notification; HR dashboard; EMPLOYEE role 403 on payroll and own-only leave list; mobile layout. Purchasing 56/56 and Sales 36/36 regressions pass; Finance 50/52 (the two misses are the cron checks in that script, which use the old sandbox secret).


## Known gaps / decisions to confirm
The full list of remaining work is in `docs/HANDOFF.md`.

- ZATCA: signing and transport are stubs (see above), so invoices carry the Phase 1 QR until EGS onboarding. Building no., district and postal code are on the Company form and feed the XML.
- Opening-balance import posts to the first day of the latest OPEN fiscal year.
- Multi-currency: rates are per document (manual) with a rate table lookup helper; FX revaluation entries are not automated.
- Hosting: Railway, see `docs/DEPLOY-RAILWAY.md`. One service with a volume for files; background jobs run in-process.
- Email: set `RESEND_API_KEY` or `SMTP_HOST`. Without one, mail is marked sent in development and stays queued in production.
- Hijri dates: display helper exists (`formatHijri`), not yet surfaced in UI.
- HR: GOSI rates, leave entitlements, sick-pay tiers and EOSB basis are seeded with the published rules but **must be verified by HR/legal** before production. The WPS file is a generic CSV (adapt column order to your bank). End-of-service accrual (monthly provision) is not automated — the settlement posts the full expense on exit. Payroll currently supports one run per period per branch.
- Purchasing: no goods receipt (by design — no inventory); a PO is billed in one step (`BILLED`); `PARTIALLY_BILLED` is reserved for a future partial-billing flow. Vendor quotes are keyed in by staff (no vendor portal).
