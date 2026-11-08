# Safina ERP (سفينة) — The Sailors

Bilingual (Arabic-first, RTL) web ERP for Saudi SMEs. Next.js 16 · TypeScript · Tailwind · shadcn/ui · Prisma/PostgreSQL · NextAuth · next-intl.

See `ARCHITECTURE.md` for the design and `PROGRESS.md` for status.

## First run (Windows / PowerShell, Node 24)

```powershell
# 1. Install
npm install

# 2. Environment
Copy-Item .env.example .env
# edit .env: DATABASE_URL + DIRECT_URL = your Supabase/Postgres SESSION pooler URL (IPv4), AUTH_SECRET = any long random string

# 3. Database
npm run db:migrate        # applies prisma/migrations
npm run db:seed           # demo data (2 companies, COA, customers, vendors, employees, users)

# 4. Run
npm run dev
# open http://localhost:3000  → redirects to /ar/login
```

Generate a secret: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`

### Demo logins (password for all: `Safina@2026`)
| Email | Role |
|---|---|
| admin@thesailors.ai | Super admin (both companies) |
| finance@thesailors.ai | Finance manager + accountant |
| sales@thesailors.ai | Sales |
| purchasing@thesailors.ai | Purchasing |
| hr@thesailors.ai | HR |
| employee@thesailors.ai | Employee (self-service) |

Customer portal (`/ar/portal`): `portal@nakheel.example` / `Portal@2026`

## Scripts
| Command | Purpose |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm run lint` · `npm run typecheck` · `npm test` | Quality gates |
| `npm run db:migrate` | Apply migrations (production-safe) |
| `npm run db:migrate:dev` | Create a new migration after editing `prisma/schema.prisma` |
| `npm run db:seed` | Idempotent demo seed |
| `npm run db:studio` | Prisma Studio |

## Scheduled jobs
Call with the secret from `.env` (Windows Task Scheduler, cron, or Vercel Cron):
- `GET /api/cron/email?secret=…` — sends queued notification emails via SMTP (every 5 min)
- `GET /api/cron/recurring-journals?secret=…` — generates due recurring journal entries (daily)
- `GET /api/cron/depreciation?secret=…` — posts last month's depreciation for all companies (monthly, e.g. 1st at 02:00)
- `GET /api/cron/document-alerts?secret=…` — employee document expiry alerts (daily)
- `GET /api/cron/expiry-alerts?secret=…` — marks expired vendor contracts and notifies purchasing users inside the alert window (daily)

## File storage
Attachments and logos are stored under `STORAGE_DIR` (default `./storage`). Swap `src/core/attachments/storage.ts` for S3-compatible storage when hosting on Vercel.

## Finance notes
- Posting rules live in `src/core/posting`; documents never write journal lines directly.
- Control-account mappings: Chart of accounts → **Mappings** tab (seeded for the demo companies).
- ZATCA: `src/core/zatca` builds UUID/ICV/PIH/hash/QR/UBL XML; transport is a stub until EGS credentials are configured.

## Purchasing notes
- Flow: purchase request → (approval) → RFQ with vendor comparison → award → purchase order → (approval if policy) → vendor bill in Finance. No goods receipt or stock — services/non-stock items only.
- Approval policy `PURCHASE_ORDER` in the seed: orders above 10,000 SAR go to Finance manager then Admin.

## HR & payroll notes
- Labour-law parameters live in **HR → Settings** (work schedule, leave rules, GOSI rate table, pay components). Seeded values follow published rules; verify with HR/legal.
- Monthly cycle: Attendance → Fill month → Payroll → New run → Calculate → Submit → Post to GL → Record payment → Generate WPS file.
- Employee self-service is at `/hr/self` for users linked to an employee (Employees → User account); the demo `employee@thesailors.ai` is linked to EMP-0015.

## Fonts
`public/fonts/IBMPlexSansArabic-*.ttf` (SIL OFL) are used both in the UI (Arabic) and in PDFs.
