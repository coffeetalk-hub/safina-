# Deploying Safina ERP on Netlify

Netlify runs the app as serverless functions, next to a Neon project that holds the database and the file bucket. There is no lasting disk and no always-on process, so a Netlify build differs from Docker and Railway in four ways:

- **Files** (attachments, logos) are stored in the database, in the `StoredFile` table. The Neon bucket `assets` in `neon.ts` is provisioned but not used yet.
- **Uploads** are capped at 4 MB per file, because Netlify accepts about 4.5 MB per request. `netlify.toml` sets this.
- **Background jobs** (email outbox, recurring journals, alerts, depreciation) run from `netlify/functions/cron-tick.mts` every 5 minutes, on published production deploys only.
- **Migrations** run in the production build command over the direct connection. Deploy previews and branch deploys skip them, because they share the production database.

## 1. The Neon project

The repo is linked to the Neon project in `.neon` (git-ignored), and `neon.ts` declares its services. To set up another machine:

```powershell
npm i -g neon@latest
neon login
neon link --project-id wispy-wind-79488894 --branch production --no-env-pull
neon env pull --file .env.local      # never into .env, which holds the local Docker settings
```

`neon deploy` applies `neon.ts` to the branch. Always pass `--no-env-pull` to `neon link`, `neon checkout` and `neon deploy`. By default they write the variables into `.env` and replace the local Docker database address.

While `.env.local` exists, `npm run dev` uses the Neon database and bucket. Rename the file to go back to local Docker.

## 2. Load the data once, from your computer

The Prisma CLI and the seed scripts only read `.env`, so run them through `npm run neon`. It loads `.env.local`, uses the direct connection and allows long transactions. It never prints connection strings.

```powershell
npm run neon -- npx prisma migrate deploy
npm run neon -- npm run db:seed                                   # demo companies and sample data
npm run neon -- npm run db:seed:team -- --lock-demo-logins        # your team; switches off the published demo logins
```

- `db:seed:team` reuses the passwords in `team-passwords.local.csv`, so everyone keeps the password they already have.
- For a real company instead of demo data, replace `db:seed` with `db:bootstrap` and set the `BOOTSTRAP_*` variables from `.env.example` first.

## 3. Create the site

1. In Netlify, choose **Add new project → Import an existing project → GitHub** and pick this repository.
2. Keep `main` as the production branch.
3. Leave the build settings alone. They come from `netlify.toml`.

## 4. Set the environment variables

Add these under **Site configuration → Environment variables**, with both the **Builds** and **Functions** scopes. Variables written in `netlify.toml` do not reach the running app, so secrets belong here.

The quickest way: open `.env.netlify` (git-ignored, holds the database URLs plus fresh `AUTH_SECRET` and `CRON_SECRET`), copy its contents, and paste them into **Add a variable → Import from a .env file**. To recreate it, map the names from `.env.local` as in this table.

| Variable | Value |
|---|---|
| `DATABASE_URL` | `DATABASE_URL` from `.env.local` (pooled) |
| `DATABASE_URL_UNPOOLED` | `DATABASE_URL_UNPOOLED` from `.env.local` (direct). The build uses it for migrations |
| `AUTH_SECRET` | A long random string (command below) |
| `CRON_SECRET` | A different long random string |
| `AUTH_URL` | Optional. Set it only for a custom domain; otherwise the site address Netlify provides is used |
| `RESEND_API_KEY` and `EMAIL_FROM` | Optional. Without them, emails stay queued and password reset links are not sent |

Generate a secret with `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`.

Deploy. Sign in with a team account from `team-passwords.local.csv`, then share each password privately and delete the file.

## Limits to know

- **Uploads** stop at 4 MB per file. The attachment box says so, and it refuses larger files before sending them.
- **Each request has 60 seconds.** Very large exports or payroll runs over that limit fail.
- **Preview deploys** use the production database without migrating it. A branch that adds a migration only works once it reaches production.
- **Neon Auth and Realtime** are switched on in `neon.ts` but not used. Safina keeps its own sign-in, roles and audit trail.
- **Build failure at the edge functions step:** Netlify packages the proxy (`src/proxy.ts`) as an edge function. There is an open Netlify issue about Turbopack builds of Next.js 16.2+ failing there with `Cannot find module './chunks/[turbopack]_runtime.js'`. If you see it, send the build log.
