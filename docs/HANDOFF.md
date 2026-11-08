# Safina ERP handoff

Last updated: 2026-11-08

## Where things stand

The application is built and has not been deployed yet. It is a single Next.js service with a Postgres database, packaged by the `Dockerfile` for Railway. Foundation, Finance, Sales & CRM, Purchasing, HR & payroll, role-based access, password reset and punch in / punch out are all in the code.

The work is on branch `railway-readiness`, which needs merging into `main`. Follow [DEPLOY-RAILWAY.md](DEPLOY-RAILWAY.md) to deploy. Two things stop real customer use after that: ZATCA Phase 2 and the payroll sign-off, both below.

## Remaining tasks

Owners: **Ops** sets up services, **Dev** writes code, **Business** decides or signs off.

### 1. Before the first deploy

- [ ] **Ops: merge `railway-readiness` into `main`.** Railway deploys from the branch it is connected to.
- [ ] **Ops: create the Railway project.** Add Postgres, a volume at `/data`, the health-check path `/api/health`, a public domain and the variables. [DEPLOY-RAILWAY.md](DEPLOY-RAILWAY.md) lists each one.
- [ ] **Ops: set up email.** See [Email](#email).
- [ ] **Ops: turn on backups** for both the Postgres service and the app volume, daily and weekly. Add a periodic off-platform `pg_dump`, because wiping a Railway volume also deletes its backups.

### 2. Right after the first deploy

- [ ] **Ops: sign in as the first admin, then delete `BOOTSTRAP_ADMIN_PASSWORD`** from the Railway variables.
- [ ] **Ops: create real users and link each one to an employee record** under HR → Employees, including the first admin. Without the link a user can't punch in or use self-service.
- [ ] **Ops: run the first-deploy checks** below. None of these have run on real Railway; they passed only against the same image behind a local HTTPS proxy.

| Check | Expected |
|---|---|
| Open `https://<domain>/api/health` | `{"status":"ok"}` |
| Sign in, move between pages | Stays signed in |
| Upload an attachment, redeploy, download it | The file is still there, which proves the volume |
| Forgot password | Email arrives and the link works once |
| After a few minutes, query the `ScheduledJob` table | Every job has `lastStatus = OK` |
| Audit log after signing in | Shows the real client address, which login throttling depends on |
| Punch in and out on a real phone | Press and hold works; only tested with a simulated mouse so far |
| GitHub Actions | The CI workflow is green; it has never run on GitHub |

### 3. Before real customers use it

- [ ] **Dev + Business: finish ZATCA Phase 2.** Invoices currently carry a Phase 1 QR and UBL XML, and nothing is signed or sent; "Submit to ZATCA" records `NOT_SUBMITTED`. It needs EGS onboarding for a CSID certificate, ECDSA signing, and a real client behind `getZatcaClient()` in `src/core/zatca`. The Phase 2 QR switches on automatically once the client is no longer the stub.
- [ ] **Dev + Business: fill in company ZATCA details.** Building number, district, postal code and VAT number on the Company form. Tax invoices refuse to post without a VAT number.
- [ ] **Business (HR/legal): sign off the payroll rules.** GOSI rates, leave entitlements, sick-pay tiers and end-of-service basis are seeded from published rules and unverified.
- [ ] **Dev + Business: adapt the WPS file** to your bank's format. It is a generic CSV today.
- [ ] **Business: test each module.** `PROGRESS.md` lists Foundation, Finance, Sales, Purchasing and HR as built and awaiting your test pass.
- [ ] **Business: review the role table** in [DEPLOY-RAILWAY.md](DEPLOY-RAILWAY.md) against how your teams work.

### 4. Should do soon

- [ ] **Dev: add error alerting.** Errors reach Railway's logs, but nothing notifies anyone. Sentry or similar needs an account.
- [ ] **Dev: move the browser checks into the repo.** Sign-out visibility, punch, password reset and large uploads were checked with temporary Playwright scripts. Only the HTTP access tests are in `tests/e2e`.
- [ ] **Dev: add a retention rule for `EmailOutbox`.** Rows are never deleted. See [Email](#email).

## Email

**Status:** the code is finished and covered by unit tests with a mocked provider. No real email has ever been sent, so delivery is unproven.

### Setting it up

1. Create a [Resend](https://resend.com) account and verify your sending domain by adding the DNS records it gives you.
2. On the Railway app service, set `RESEND_API_KEY` and `EMAIL_FROM`, for example `Safina ERP <no-reply@your-domain>`. The default sender is a placeholder that won't deliver.
3. Use the SMTP variables (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`) only on Railway's Pro plan, because lower plans block SMTP. If both are set, Resend is used.
4. Test with Forgot password on the sign-in page. The email should arrive within seconds.
5. If it doesn't, look for `[email]` lines in Railway's logs and check `status` and `lastError` in the `EmailOutbox` table.

### What gets sent

| Email | Goes to | When |
|---|---|---|
| Password reset (staff and portal) | The person asking | Immediately; link works once, for one hour |
| Approval requested | Approvers at the current step | On submit and when a step advances |
| Approved / rejected | The requester | On the final decision |
| Employee document expiring | HR users and the employee | Daily, inside the alert window |
| Vendor contract expiring | Purchasing users | Daily, inside the alert window |

Leave decisions, RFQ awards and CRM activity assignments are in-app only.

### How the queue behaves

- Mail is written to `EmailOutbox`, and up to 50 messages go out every 5 minutes.
- A message that fails is retried up to 5 times, then marked `FAILED` and left alone.
- With no provider in production, mail stays `PENDING` and is logged as an error.
- **Everything queued goes out once a provider is added.** If the app has run for a while without one, discard the backlog first:

```sql
UPDATE "EmailOutbox" SET status = 'FAILED', "lastError" = 'Discarded before email went live' WHERE status = 'PENDING';
```

### Email work still to build

- [ ] **Dev: connect the "email notifications" switch in Settings.** It saves but has no effect; `notify()` in `src/core/notifications` queues mail regardless.
- [ ] **Dev: delete old `EmailOutbox` rows** in the daily `maintenance` job. The table grows forever and keeps reset links, which are expired but still clutter it.
- [ ] **Dev: consider new-user invitations.** An admin sets a password by hand today, and no welcome email exists.
- [ ] **Dev: consider emailing invoices to customers.** There is no send-invoice feature; customers download them from the portal.
- [ ] **Dev: consider bounce and delivery tracking.** A message counts as sent once the provider accepts it.

## Decisions to confirm

- **Purchase requests:** employees can raise and track only their own. Removing that is a small change to the `EMPLOYEE` template in `src/core/rbac/permissions.ts`, plus a migration for existing roles.
- **Punches and payroll:** lateness and overtime from punches feed payroll like HR-entered attendance. Confirm that's the intended policy, especially for overtime.
- **"Fill month" hides no-shows:** it pre-fills days as Present, including future ones, so someone who never punches still looks present unless HR marks them absent. Decide whether punching replaces Fill month.
- **Punch controls:** there is no GPS or device restriction, so anyone signed in can punch from anywhere.
- **Finance and the audit log:** the audit log is admin-only because it contains HR field changes. If Finance needs it, it should be filtered by module first.

## Known limits

**Punch in / out**
- One first-in, last-out pair per day; breaks aren't tracked separately.
- Riyadh time is fixed in code.
- `Employee.userId` is unique, so a user who works in two companies can punch in only one.
- A punch-in left open for 16 hours is treated as a forgotten punch-out, and HR corrects that day.

**Railway**
- A service with a volume can't have replicas, and redeploys briefly interrupt it.
- There is deliberately no `railway.json`, because Railway is retiring it on 2026-12-01. `.railway/railway.ts` is optional.
- The image is about 1.8 GB. Next.js standalone output could shrink it.

**Product gaps carried from `PROGRESS.md`**
- FX revaluation isn't automated.
- Hijri dates exist as a helper but aren't shown.
- End-of-service isn't accrued monthly.
- One payroll run per period per branch.
- Purchase orders bill in one step; there's no goods receipt, by design.
- Vendor quotes are keyed in by staff.

**Dependencies**
- `npm audit` was clean on 2026-11-08 using overrides for `nodemailer`, `deepmerge-ts` and `uuid`. Recheck them when upgrading.
- `next-auth` is a v5 beta.
- Prisma 7 removes the `package.json#prisma` seed setting.

## Demo accounts

These exist only when the demo seed is loaded, and their passwords are published in `README.md`. Never load the demo seed in production.

| Email | Role | Linked employee (first company) |
|---|---|---|
| `admin@thesailors.ai` | Super admin | EMP-0001 |
| `finance@thesailors.ai` | Finance manager + accountant | EMP-0002 |
| `sales@thesailors.ai` | Sales | EMP-0003 |
| `hr@thesailors.ai` | HR | EMP-0004 |
| `purchasing@thesailors.ai` | Purchasing | EMP-0005 |
| `employee@thesailors.ai` | Employee | EMP-0015 |
| `portal@nakheel.example` | Customer portal | None |

## Working on the code

```powershell
npm install                # also generates the Prisma client
Copy-Item .env.example .env  # then set AUTH_SECRET and CRON_SECRET
docker compose up -d       # Postgres on port 5433
npm run db:migrate
npm run db:seed
npm run dev
```

| Command | Purpose |
|---|---|
| `npm run lint`, `npm run typecheck`, `npm test` | Quality checks (34 unit tests) |
| `npm run test:e2e` | 15 role and access tests against a running demo-seeded server; set `E2E_BASE_URL` |
| `docker build -t safina-erp .` | The production image Railway will build |

| Where | What |
|---|---|
| `src/core/rbac/permissions.ts` | Permission catalogue and role templates |
| `src/modules/hr/punch.ts`, `src/components/punch/` | Punch logic and UI |
| `src/core/notifications/index.ts` | Email queue and providers |
| `src/core/cron/schedule.ts` | Background job timetable |
| `docker-entrypoint.sh` | Migrations and first-run setup at every start |
| `ARCHITECTURE.md`, `PROGRESS.md` | Design and module status |
