# Deployment guide

This covers two paths: testing locally first (recommended — do this before
touching Vercel), then deploying to Vercel for real.

## Path A — test locally first

**1. Start Postgres.**
```
docker compose up -d
```
This starts Postgres 16 on `localhost:5432` with the credentials already
baked into `docker-compose.yml` (`ejas` / `ejas_local_dev`, database
`ejas_web`). Don't reuse these credentials anywhere real — they only
exist for local testing.

**2. Set up your environment.**
```
cp .env.example .env
```
The default `DATABASE_URL` in `.env.example` already matches
`docker-compose.yml`, so no editing needed for local testing.

**3. Install dependencies and create the database schema.**
```
npm install
npx prisma db push
```
`db push` reads `prisma/schema.prisma` and creates every table, enum, and
index directly — no migration history, just "make the database match the
schema." This is the right tool for now, while the schema is still
actively changing. Once the schema stabilizes and you want a real
migration history (needed for team collaboration and safe production
upgrades later), switch to `npx prisma migrate dev` instead — see the
note at the bottom.

**4. Seed the starter ATC codes.**
```
npm run prisma:seed
```
Remember: these are only the codes shown in the manual's own screenshots,
not a complete or current BIR table. See `prisma/seed.ts` for the full
disclaimer.

**5. Run the app.**
```
npm run dev
```
Open http://localhost:3000/company/setup and create your company — every
other page depends on this existing first. Then:
1. `/accounts` — build out your Chart of Accounts (at minimum: one Cash
   in Bank account, one Accounts Receivable, one Accounts Payable, one
   Input VAT, one Output VAT, one Withholding Tax Payable, one
   Creditable Withholding Tax account).
2. `/company/tax-posting-setup` — point the four tax accounts at what you
   just created.
3. `/agents` — add at least one customer and one vendor.
4. Post a transaction through `/transactions/cash-disbursement` or any
   other journal, then check `/reports/trial-balance` — it should show
   your entry and the "debits equal credits" check should be green.

If all of that works, the app is functioning correctly end to end.

## Path B — deploy to Vercel

**1. Get a hosted Postgres database.** Vercel doesn't include a database
by default. Two easy options:
- **Vercel Postgres** (built into the Vercel dashboard — Storage tab →
  Create Database → Postgres). Simplest if you're already in Vercel.
- **Neon** (neon.tech) — generous free tier, works well with serverless
  functions specifically because it supports connection pooling over
  HTTP, which matters for Vercel's serverless environment.

Either way, you'll get a `DATABASE_URL` connection string. If you use
Neon, use the **pooled** connection string (usually has `-pooler` in the
hostname) — Vercel's serverless functions open a new connection per
request, and an unpooled Postgres connection limit gets exhausted fast.

**2. Push this project to GitHub.** Vercel deploys from a Git repo.
```
git init
git add .
git commit -m "Initial commit"
git remote add origin <your-github-repo-url>
git push -u origin main
```
`.gitignore` already excludes `.env` and `node_modules` — double-check
`git status` doesn't show `.env` before your first commit.

**3. Import the project in Vercel** (vercel.com → Add New → Project →
import your GitHub repo).

**4. Set the environment variable.** In the Vercel project's Settings →
Environment Variables, add `DATABASE_URL` with the connection string
from step 1. Do this for Production, Preview, and Development
environments.

**5. Deploy.** Vercel will run `npm install` (triggers `postinstall` →
`prisma generate`) then `npm run build` (which also runs `prisma
generate` again, redundant but harmless — see the note on why this
matters below). The build itself doesn't need `DATABASE_URL` — every
page is forced to render dynamically at request time (see the note
below), so no database queries run during the build. If the build
succeeds but pages error at runtime with a database connection error,
that means `DATABASE_URL` isn't set correctly for the Production
environment specifically — double-check it's there and that you used the
pooled URL if on Neon.

**6. Push the schema to the hosted database.** Vercel doesn't run
`prisma db push` automatically — do this once from your local machine,
pointed at the hosted database:
```
DATABASE_URL="<the hosted connection string>" npx prisma db push
DATABASE_URL="<the hosted connection string>" npm run prisma:seed
```

**7. Visit the deployed URL and repeat the same first-run steps as
Path A** (company setup → accounts → tax posting setup → agents → post a
transaction → check trial balance).

## Why every page is forced to render dynamically

`app/layout.tsx` sets `export const dynamic = "force-dynamic"`, which
applies to every page nested under it — the whole app. Without this,
Next.js tries to statically pre-render pages at build time by default,
which means running Prisma queries *inside the Vercel build container*.
That container doesn't have reliable database access, so the build fails
with `Environment variable not found: DATABASE_URL` even if you've set it
correctly for runtime. Since every page here reflects live database
state (account balances, ledger entries, reports), none of it should
ever be cached as static HTML anyway — this setting is both the fix and
the architecturally correct choice.

## Why `prisma generate` is in both `postinstall` and `build`

Vercel caches `node_modules` between builds. If `prisma generate` only
ran in `postinstall` and Vercel skips `npm install` on a cache hit, the
generated Prisma Client could go stale against schema changes. Running it
again in `build` costs a few seconds and guarantees correctness. This is
a genuinely common Vercel+Prisma gotcha — skipping this step is the
single most frequent reason a Prisma app deploys "successfully" and then
500s on the first database call.

## `db push` vs. `migrate dev` — when to switch

`db push` is fine while you're the only one working on this and the
schema is still moving. Switch to `prisma migrate dev` once:
- more than one person is working on the schema, or
- you need a reviewable history of schema changes, or
- you're getting close to a real production launch with real data you
  can't afford to reset.

Switching later means running `npx prisma migrate dev --name init` once,
which generates a migration history starting from the current schema —
no data loss, just adds the tracking `db push` doesn't have.
