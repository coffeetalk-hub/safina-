# Deploying Safina ERP on Railway

The app is one Next.js service: pages and API run together, next to a Railway Postgres database. Railway builds the `Dockerfile` in this repo. On every start the container applies pending migrations, runs first-time setup, then starts the server, so there is no separate migrate step.

## 1. Create the project

1. In Railway, create a project and add **Deploy from GitHub repo**, choosing this repository.
2. In the same project, add **Database → PostgreSQL**.
3. On the app service, add a **Volume** mounted at `/data`. Attachments and logos live there.
4. On the app service, open **Settings** and set the **Healthcheck Path** to `/api/health`. Under **Networking**, generate a public domain.

## 2. Set the app service variables

| Variable | Value |
|---|---|
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` |
| `AUTH_SECRET` | A long random string (command below) |
| `CRON_SECRET` | A different long random string |
| `AUTH_URL` | `https://${{RAILWAY_PUBLIC_DOMAIN}}` |
| `STORAGE_DIR` | `/data/storage` |
| `RESEND_API_KEY` | Key from [resend.com](https://resend.com) |
| `EMAIL_FROM` | `Safina ERP <no-reply@your-domain>`, on a domain verified with Resend |
| `BOOTSTRAP_ADMIN_EMAIL` | The first administrator's email |
| `BOOTSTRAP_ADMIN_PASSWORD` | At least 12 characters |
| `BOOTSTRAP_COMPANY_NAME_EN` / `BOOTSTRAP_COMPANY_NAME_AR` | Your company name |
| `BOOTSTRAP_COMPANY_VAT` | Your VAT number. Tax invoices can't be posted without one |

Generate a secret with `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`.

Deploy. The first start creates the super admin, the company, the default roles and the Saudi chart of accounts. After you sign in, delete `BOOTSTRAP_ADMIN_PASSWORD` from the variables.

## 3. Turn on backups

Backups are not on by default. Open the **Backups** tab on both the **Postgres** service and the **app volume**, and add a daily schedule. Railway keeps daily backups for 6 days, weekly for 27 and monthly for 89, so add a weekly schedule too. Backups are deleted if the volume is wiped, so keep a periodic off-platform `pg_dump` for the books.

## Things to know

- **Email:** Railway blocks SMTP below the Pro plan, which is why `RESEND_API_KEY` is the default. `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER` and `SMTP_PASS` work on Pro. With neither set, mail stays queued and is logged as an error, and password-reset links can't be delivered.
- **One replica:** Railway does not allow replicas on a service with a volume, and a redeploy has a brief interruption.
- **Background jobs** run inside the app, checked every minute, and need `CRON_SECRET`: email every 5 minutes, recurring journals and alerts daily, depreciation monthly. Hours are Riyadh time. A run missed during a deploy is caught up afterwards.
- **`railway.json` is deliberately absent:** Railway no longer accepts it for new services and stops reading it on 2026-12-01. The settings above live in the dashboard. Railway's replacement, `.railway/railway.ts`, is optional: run `railway config pull` to generate it from the live project.
- **Demo data:** setting `ALLOW_DEMO_SEED=true` loads the demo companies on every start, with passwords that are published in this repository. Use it only on a throwaway environment, and never with real data.

## Before real customers use it

- **ZATCA:** invoices carry a Phase 1 QR code and the UBL XML, but nothing is signed or sent to ZATCA. Phase 2 needs EGS onboarding (CSID certificate) and a real client behind `getZatcaClient()` in `src/core/zatca`.
- **Payroll:** GOSI rates, leave entitlements and end-of-service rules need sign-off from HR or legal. The WPS file is a generic CSV and must be matched to your bank's format.

## Who can see what

Every permission is company-wide. Personal access has its own permissions, `hr.self` and `purchasing.myRequest`, and those only ever return the signed-in person's own records.

| Role | Sees |
|---|---|
| Employee | Own HR record (leave, attendance, payslips, documents, loans) and purchase requests they raised |
| Sales | Sales & CRM, customers, items, invoices and receipts |
| Purchasing | Purchasing, vendors, items, vendor bills |
| HR | All of HR & payroll, the employee directory, branches and cost centers |
| Accountant | Finance, finance master data, sales orders and quotations, purchase orders and contracts |
| Finance manager | As accountant, plus approvals and all purchasing documents |
| Approver | Finance, sales documents and purchasing documents, plus leave and loans, to view and approve |
| Administrator | Everything, including users, roles, settings and the audit log |

Someone who works in Sales and also needs to request leave holds both the Sales and Employee roles. Their user must be linked to an employee record under **HR → Employees**.

Punch in / punch out is open to every role, and always applies to the signed-in person at the server's current time. It needs that same link to an employee record, so link each user once they exist, including the first administrator. Without a link, the header explains what to ask HR for.
