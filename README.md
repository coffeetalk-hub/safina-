# Safina ERP (سفينة) — The Sailors

Bilingual (Arabic-first, RTL) web ERP for Saudi SMEs. Next.js 16 · TypeScript · Tailwind · shadcn/ui · Prisma/PostgreSQL · NextAuth · next-intl.

See `ARCHITECTURE.md` for the design, `PROGRESS.md` for status, `docs/DEPLOY-RAILWAY.md` to deploy and `docs/HANDOFF.md` for the remaining work.

## First run (Windows / PowerShell, Node 24)

```powershell
# 1. Install
npm install

# 2. Environment
Copy-Item .env.example .env
# edit .env: AUTH_SECRET and CRON_SECRET = any long random strings

# 3. Database
docker compose up -d      # local Postgres on port 5433, matching .env.example
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
| `npm run test:e2e` | Role and access checks against a running, demo-seeded server (`E2E_BASE_URL`) |
| `npm run db:migrate` | Apply migrations (production-safe) |
| `npm run db:migrate:dev` | Create a new migration after editing `prisma/schema.prisma` |
| `npm run db:seed` | Idempotent demo seed (refuses to run in production) |
| `npm run db:bootstrap` | First super admin and company for a real deployment, from `BOOTSTRAP_*` variables |
| `npm run db:studio` | Prisma Studio |

## Scheduled jobs
In production the server runs these itself, checking every minute (`src/core/cron/schedule.ts`, Riyadh time). It needs `CRON_SECRET`:
- `email` — sends queued notification emails (every 5 min)
- `recurring-journals` — generates due recurring journal entries (daily)
- `depreciation` — posts last month's depreciation for all companies (monthly)
- `document-alerts` — employee document expiry alerts (daily)
- `expiry-alerts` — marks expired vendor contracts and notifies purchasing users inside the alert window (daily)

To run one by hand: `GET /api/cron/<job>` with `Authorization: Bearer <CRON_SECRET>`. `/api/cron/tick` runs whatever is due.

## File storage
Attachments and logos are stored under `STORAGE_DIR` (default `./storage`). On Railway this is a volume mounted at `/data`.

## Finance notes
- Posting rules live in `src/core/posting`; documents never write journal lines directly.
- Control-account mappings: Chart of accounts → **Mappings** tab (seeded for the demo companies).
- ZATCA: `src/core/zatca` builds UUID/ICV/PIH/hash/QR/UBL XML; signing and transport are stubs until EGS credentials are configured, and invoices carry the Phase 1 QR until then.

## Purchasing notes
- Flow: purchase request → (approval) → RFQ with vendor comparison → award → purchase order → (approval if policy) → vendor bill in Finance. No goods receipt or stock — services/non-stock items only.
- Approval policy `PURCHASE_ORDER` in the seed: orders above 10,000 SAR go to Finance manager then Admin.

## HR & payroll notes
- Labour-law parameters live in **HR → Settings** (work schedule, leave rules, GOSI rate table, pay components). Seeded values follow published rules; verify with HR/legal.
- Monthly cycle: Attendance → Fill month → Payroll → New run → Calculate → Submit → Post to GL → Record payment → Generate WPS file.
- Employee self-service is at `/hr/self` for users linked to an employee (Employees → User account); the demo `employee@thesailors.ai` is linked to EMP-0015.
- Punch in / out: press and hold in the header or on the dashboard, for every role whose user is linked to an employee. Punches fill the day's attendance record (first in, last out), which feeds payroll like HR-entered attendance. Times are Riyadh time from the server.
- Access: company-wide permissions (`hr.leave:view`) are separate from personal ones (`hr.self`, `purchasing.myRequest`). See the role table in `docs/DEPLOY-RAILWAY.md`.

## Fonts
`public/fonts/IBMPlexSansArabic-*.ttf` (SIL OFL) are used both in the UI (Arabic) and in PDFs.
