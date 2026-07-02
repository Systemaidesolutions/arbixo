# Changes — user/login restructure, verification fix, nav redesign

## 1. Verification code not being sent — fixed

Root cause: `lib/mail.ts` only sends email when `RESEND_API_KEY` is set.
Without it, the code was logged to the server console and registration
still reported success, so the UI said "check your email" for a message
that was never sent.

- `sendVerificationEmail` now returns `{ delivered: boolean }`.
- `POST /api/auth/register` relays that as `emailDelivered` and returns a
  502 (instead of a 500) if the mail service errors.
- New `POST /api/auth/resend-code` re-issues a code for an unverified
  account. Responds identically whether or not the email exists, to
  avoid account enumeration.
- Verify page: added a "Resend code" button (30s cooldown) and an amber
  banner when email delivery isn't configured.

ACTION REQUIRED to send real emails: set `RESEND_API_KEY` (and optionally
`EMAIL_FROM`) in the environment. The Gmail address in the UI won't work
as a Resend sender without domain verification; alternatively switch
`lib/mail.ts` to Gmail SMTP with an App Password.

## 2. User / login module restructure

- New `UserType { ADMIN, SUBSCRIBER }` enum and nullable `companyId` FK
  on `User` (schema.prisma). ADMIN = ARbixo staff (cross-tenant),
  SUBSCRIBER = a company's user.
- `SessionPayload` (lib/auth.ts) now carries `userType` and `companyId`;
  login and verify routes mint tokens with them. Old tokens default to
  SUBSCRIBER so they aren't silently granted admin scope.
- Subscribers keep using the existing dashboard, now scoped to their own
  company (was `prisma.company.findFirst()`).
- Admins are redirected to a new `/admin` area (route group
  `app/(admin)`): Overview, Company list, User list, Setup. Setup is a
  menu placeholder per the "to follow" note.
- Admin routes gated in `middleware.ts` (edge) and again in
  `requireAdmin()` (lib/authz.ts) inside the admin layout.
- Seed's bootstrap account now sets `userType: ADMIN`.

## 3. Interface

- Sidebar section labels +4pt (text-sm -> text-lg, 14->18px), links
  +4pt (text-xs -> text-base, 12->16px).
- Active page is now a solid brand-navy highlight with white text
  (was a faint tint), matching the screenshot. `aria-current="page"` set.

## Run before using
    npx prisma generate
    npx prisma migrate dev      # or: npx prisma db push

(Couldn't be run in the build environment — no network for install.)

## Follow-ups NOT done in this pass (deliberately)

1. Per-company scoping of the ~17 transaction/report/setup pages and
   their API routes that still call `prisma.company.findFirst()`. This is
   the largest remaining item and is unsafe to half-do (would leak one
   tenant's data into another). Migration path is in place:
   - `lib/scopedCompany.ts` — `getScopedCompany()` for (app) pages
   - `lib/authz.ts` — `resolveCompanyId()` for API routes
2. No admin UI yet to create subscriber users or assign them to a
   company. The list pages are read-only. Decide how subscribers get
   provisioned (admin invite flow, self-serve signup that creates a
   company, etc.).
