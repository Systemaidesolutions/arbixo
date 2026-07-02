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
`docker-compose.yml`, so no editing needed for local testing. You do
need to fill in two more things before the app will run at all:
- `AUTH_SECRET` — generate a real one with `openssl rand -base64 32`.
  Sessions are signed JWTs; without this set, every login attempt throws.
- `ADMIN_EMAIL` / `ADMIN_PASSWORD` — your own login. The seed script
  (next step) creates this account pre-verified, since there's no one
  else yet to send a verification email to.

`RESEND_API_KEY` can stay blank for local testing — without it,
verification codes for anyone who registers print to the server console
instead of being emailed.

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

**4. Seed the starter ATC codes and your admin account.**
```
npm run prisma:seed
```
Remember: the ATC codes are only the ones shown in the manual's own
screenshots, not a complete or current BIR table. See `prisma/seed.ts`
for the full disclaimer. This also creates your global admin account
from `ADMIN_EMAIL`/`ADMIN_PASSWORD`, pre-verified.

**5. Run the app.**
```
npm run dev
```
Open http://localhost:3000 — you'll land on `/login` first (middleware
redirects anyone without a session there). Log in with `ADMIN_EMAIL` /
`ADMIN_PASSWORD`. From there:
1. `/company/setup` — every other page depends on this existing first.
2. `/accounts` — build out your Chart of Accounts (at minimum: one Cash
   in Bank account, one Accounts Receivable, one Accounts Payable, one
   Input VAT, one Output VAT, one Withholding Tax Payable, one
   Creditable Withholding Tax account).
3. `/company/tax-posting-setup` — point the four tax accounts at what you
   just created.
4. `/agents` — add at least one customer and one vendor.
5. Post a transaction through `/transactions/cash-disbursement` or any
   other journal, then check `/reports/trial-balance` — it should show
   your entry and the "debits equal credits" check should be green.

To test registration as a second user: log out, go to `/register`, sign
up with a different email. Since `RESEND_API_KEY` is blank locally, the
verification code prints to your terminal (the one running `npm run
dev`) instead of arriving by email — copy it into the `/verify` page.

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

**4. Set the environment variables.** In the Vercel project's Settings →
Environment Variables, add for Production, Preview, and Development:
- `DATABASE_URL` — from step 1
- `AUTH_SECRET` — generate with `openssl rand -base64 32`; use a
  different value than your local `.env`
- `ADMIN_EMAIL` / `ADMIN_PASSWORD` — your production login
- `RESEND_API_KEY` / `EMAIL_FROM` — only if you want registration emails
  to actually send in production (strongly recommended for anything
  beyond your own testing — without it, verification codes for anyone
  who self-registers only appear in Vercel's function logs, which they
  can't see)

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

**6. Push the schema to the hosted database and seed it.** Vercel
doesn't run this automatically — do it once from your local machine,
pointed at the hosted database:
```
DATABASE_URL="<the hosted connection string>" npx prisma db push
DATABASE_URL="<the hosted connection string>" ADMIN_EMAIL="..." ADMIN_PASSWORD="..." npm run prisma:seed
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
