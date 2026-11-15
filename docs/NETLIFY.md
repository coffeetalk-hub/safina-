# Deploying Safina ERP on Netlify

Netlify runs the app as serverless functions next to a hosted PostgreSQL database. There is no lasting disk and no always-on process, so a Netlify build differs from Docker and Railway in four ways. `netlify.toml` switches all of them on:

- **Files** (attachments, logos) are stored in the database, in the `StoredFile` table.
- **Uploads** are capped at 4 MB per file, because Netlify accepts about 4.5 MB per request.
- **Background jobs** (email outbox, recurring journals, alerts, depreciation) run from `netlify/functions/cron-tick.mts` every 5 minutes, on published production deploys only.
- **Migrations** run in the production build command. Deploy previews and branch deploys skip them, because they share the production database.

## 1. Create the database

Use any PostgreSQL 16 host that gives a pooled and a direct connection string. [Neon](https://neon.tech) has a free tier.

1. Create a project in the AWS region closest to your Netlify functions region (Netlify shows it under **Site configuration → Functions**).
2. Copy two connection strings: the **pooled** one (host contains `-pooler`) and the **direct** one.

## 2. Load the data once, from your computer

Run this in PowerShell from the repo, using the **direct** connection string. The team seed prints the database it is writing to, so check it before going further.

```powershell
$env:DATABASE_URL = "postgresql://...direct connection string..."
npx prisma migrate deploy
npm run db:seed                                  # demo companies and sample data, for a prototype
npm run db:seed:team -- --lock-demo-logins       # your team; switches off the published demo logins
Remove-Item Env:DATABASE_URL
```

- `db:seed:team` reuses the passwords in `team-passwords.local.csv`, so everyone keeps the password they got for the local copy. Without that file it creates new ones and writes the file.
- For a real company instead of demo data, replace `db:seed` with `db:bootstrap` and set the `BOOTSTRAP_*` variables from `.env.example` first.

## 3. Create the site

1. In Netlify, choose **Add new project → Import an existing project → GitHub** and pick this repository.
2. Set the production branch to the branch you deploy (merge into `main` first, or pick the branch directly).
3. Leave the build settings alone. They come from `netlify.toml`.

## 4. Set the environment variables

Add these under **Site configuration → Environment variables**, with both the **Builds** and **Functions** scopes. Variables written in `netlify.toml` do not reach the running app, so secrets belong here.

| Variable | Value |
|---|---|
| `DATABASE_URL` | Pooled connection string |
| `DATABASE_URL_UNPOOLED` | Direct connection string. The build uses it for migrations |
| `AUTH_SECRET` | A long random string (command below) |
| `CRON_SECRET` | A different long random string |
| `AUTH_URL` | `https://<your-site>.netlify.app`, or your custom domain |
| `RESEND_API_KEY` and `EMAIL_FROM` | Optional. Without them, emails stay queued and password reset links are not sent |

Generate a secret with `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`.

Deploy. Sign in with a team account from `team-passwords.local.csv`, then share each password privately and delete the file.

## Limits to know

- **Uploads** stop at 4 MB per file. The attachment box says so, and it refuses larger files before sending them.
- **Files count against the database size.** Free database tiers are small, so keep an eye on usage if people upload many scans.
- **Each request has 60 seconds.** Very large exports or payroll runs over that limit fail.
- **Preview deploys** use the production database without migrating it. A branch that adds a migration only works once it reaches production.
- **Build failure at the edge functions step:** Netlify packages the proxy (`src/proxy.ts`) as an edge function. There is an open Netlify issue about Turbopack builds of Next.js 16.2+ failing there with `Cannot find module './chunks/[turbopack]_runtime.js'`. If you see it, send the build log.
