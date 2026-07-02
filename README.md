# EJAS Web — conversion notes

This maps the "Easy Journal Accounting System" desktop manual onto the
Next.js + Prisma + Postgres stack, following Business Central conventions
where they diverge from the manual.

## What `prisma/schema.prisma` captures

| Manual section | Schema model |
|---|---|
| 1.1 Setup Company | `Company` |
| 3.4 Setup Location (branches) | `Location` |
| 1.2 Chart of Accounts | `Account` — hierarchy, normal balance, opening balance |
| 1.3 Setup Agent | Split into `Customer`, `Vendor`, `Employee`, `Contact` |
| 1.5–1.9 The five journals | `LedgerEntry` — one flat table, `documentNo` groups related lines |
| VAT Computation popup | `VatType`, `grossAmount`/`netAmount`/`vatAmount` on `LedgerEntry` |
| Withholding tax (ATC codes) | `atcCode`, `withholdingAmt` on `LedgerEntry` |
| 1.10 Capital Goods / Importation | dedicated `import*` fields on `LedgerEntry` |
| 4.1 Audit Trail | `AuditLog` |

### LedgerEntry — single flat table, BC G/L Entry style

No separate header/line split. `documentNo` groups every row belonging to
one transaction (one CV, one Invoice, one JV) — the same role BC's
`Document No.` plays on G/L Entry. Each row carries `entryNo`, an immutable
auto-incrementing sequence, as the permanent ledger reference; `journalType`
is the Source Code equivalent (which of the five portals posted it).

### Chart of Accounts — hierarchy + normal balance + opening balance

`Account.parentAccountId`/`children` let "Cash in Bank" be a parent of
"Cash in Bank - BPI", "Cash in Bank - EIB", etc. `normalBalance` is
explicit rather than derived from `classification`, because contra
accounts break the simple mapping — Accumulated Depreciation is
classified as an asset-side account but carries a CREDIT normal balance.
Deferred for later: Posting vs. Heading/Total account types (non-postable
subtotal rows).

### Agent — split into Customer / Vendor / Employee / Contact

The manual's single `Agent` table (with an `AgentType` discriminator)
became four separate tables, matching how BC keeps these as distinct
entities with their own field sets and code sequences rather than one
polymorphic table:

- `Customer` — `customerType`: PRIVATE / GOVERNMENT. Government customers
  trigger the manual's multiple-withholding-tax flow.
- `Vendor` — `vendorType`: SUPPLIER / GOVERNMENT_AGENCY (BIR/SSS/PhilHealth/
  Pag-IBIG remittance payees).
- `Employee` — always an individual; no tax-classification branching.
- `Contact` — catch-all for parties that are none of the above (a lender,
  an owner on an equity drawdown).

`LedgerEntry` links to whichever applies via four optional FKs
(`customerId`/`vendorId`/`employeeId`/`contactId`) plus a
`counterpartyType` enum for convenient filtering without four null-checks.
Only one of the four should be populated per entry — enforced at the API
layer, since Prisma has no native "exactly one of" constraint.

## What's built so far

- **Chart of Accounts** (`app/accounts/`) — tree UI grouped by
  classification, collapsible sub-accounts, inline create/edit/delete.
  API at `app/api/accounts/`.
- **Company setup** (`app/company/setup/`) — singleton settings form
  (POST once to create, PATCH after). API at `app/api/company/`.
- **Agents** (`app/agents/`) — tabbed UI (Customers/Vendors/Employees/
  Contacts) sharing one `PartyManager` component, parameterized by entity
  type since the four models differ (Employee has no tax classification;
  only Customer has `customerType`; only Vendor has `vendorType`). APIs at
  `app/api/customers/`, `app/api/vendors/`, `app/api/employees/`,
  `app/api/contacts/`.
- **VAT / withholding calculator** (`lib/vat.ts`) — pure functions,
  framework-agnostic, verified with `npm test` against the manual's own
  worked examples (page 16, 25, 59). `computeVat` handles the Gross↔Net↔VAT
  three-way split from the manual's "VAT Computation" popup; `computeWithholding`
  applies an ATC rate to the Net amount. Wired into a reusable
  `<VatComputationFields>` component (`components/`) with a standalone
  test harness at `app/tools/vat-calculator/`. ATC rates live in an
  editable `AtcCode` table (`app/api/atc-codes/`) rather than being
  hardcoded — BIR revises these periodically (RR No. 5-2025 and RR No.
  24-2025 both changed creditable withholding rates within the same
  year), so the seed data (`prisma/seed.ts`) is explicitly a starting
  point, not an authoritative table. Verify against
  https://www.bir.gov.ph/WithHoldingTax before relying on it.
- **Tax Posting Setup** (`app/company/tax-posting-setup/`) — tells the
  posting engine which GL accounts to hit for Input VAT, Output VAT,
  Withholding Tax Payable, and Creditable Withholding Tax (four accounts,
  not three — see the Cash Receipts note below for why the withholding
  side needs two separate accounts). The manual does this invisibly;
  here it's explicit and editable, same idea as BC's VAT Posting Setup.
- **Cash Disbursement** (`app/transactions/cash-disbursement/`) — the
  first journal screen, and the one every other journal will borrow its
  shape from:
  - `lib/ledgerPosting.ts` — `postDocument()` is the one function that
    ever calls `prisma.ledgerEntry.create`. It validates double-entry
    balance (to the centavo) and checks the document number isn't
    already used, then writes every line of a document atomically via
    `$transaction` — either the whole document posts or none of it does.
  - The API route (`app/api/ledger-entries/cash-disbursement/`) expands
    each user-entered line into up to four real GL lines: the main line
    (always at Net amount, never Gross — the Gross figure is metadata
    only), an auto Input VAT line if the line has VAT, an auto
    Withholding Payable credit if it has an ATC code, and a single
    balancing Cash credit line at the end.
  - `<CounterpartyPicker>` (`components/`) — Vendor/Employee/Contact/
    Customer selector, needed because `LedgerEntry` has four separate FKs
    instead of one `Agent`. Label is configurable ("Payee" on
    disbursements, "Payor" on receipts, per the manual's own terminology).
  - `<TransactionSummary>` (`components/`) — generic, journal-type-agnostic
    month/year list with cancel, backed by `app/api/ledger-entries/route.ts`
    (Transaction Summary query) and `app/api/ledger-entries/cancel/` — both
    take a `journalType` parameter, so every journal reuses them without
    new endpoints.
- **Cash Receipts** (`app/transactions/cash-receipts/`) — the mirror of
  Cash Disbursement, built second specifically to prove the shared pieces
  (`postDocument`, `<VatComputationFields>`, `<CounterpartyPicker>`,
  `<TransactionSummary>`) actually generalize rather than needing a
  rewrite. One genuine asymmetry, not just a debit/credit flip: when a
  **customer** withholds tax from paying **us**, the withheld amount is
  an ASSET (Creditable Withholding Tax — offsets our income tax due
  later), not the same liability account Cash Disbursement credits when
  *we* withhold from a vendor. Confirmed against the manual's own
  screenshots — Cash Receipts labels that column "WITAX (DEBIT)" where
  Cash Disbursement labels it "W/TAX (CREDIT)". `TaxPostingSetup` now has
  four accounts, not three, to keep these separate.
- **Sales on Account / Purchases on Account**
  (`app/transactions/sales/`, `app/transactions/purchases/`) — same shape
  as the two cash journals, but nothing changes hands yet: the balancing
  line hits Accounts Receivable (Sales, debit) or Accounts Payable
  (Purchases, credit) instead of a cash account, so there's no "which
  bank account" picker at all. Settlement happens later as a separate
  Cash Receipts/Disbursement entry against the same customer/vendor.
  - **Sales Return / Purchase Return** are implemented as the normal
    entry, reversed — not a separate rule set. `flipLines()`
    (`lib/vatLineExpansion.ts`) swaps every line's debit and credit after
    the normal expansion runs, and `documentType` switches to
    `CREDIT_MEMO`. This matches the manual's own description: "the same
    steps... except clicking the Sales Return button."
  - Refactored `lib/vatLineExpansion.ts` out of the two cash journals'
    routes at this point, once a third and fourth journal needed the same
    line-expansion logic — `expandVatLines()` takes a `direction`
    (`DEBIT` for money-out journals, `CREDIT` for money-in journals) and
    produces the main + VAT + withholding companion lines; each journal's
    route just adds its own balancing line (Cash, AR, or AP) on top.
- **General Journal** (`app/transactions/general-journal/`) — the fifth
  and final journal, and deliberately the odd one out: no auto VAT/
  withholding expansion at all. The manual's own General Journal use
  cases (capital goods purchases, importation, and critically, closing
  Input/Output VAT to VAT Payable) require the user to pick *both* sides
  of the entry directly — the VAT-closing entries specifically need the
  VAT-computation prompt **declined**, which only makes sense if the
  journal doesn't force it on every line. The optional per-line VAT
  calculator here is informational only (tags gross/net/VAT/ATC for BIR
  reports via small "Use net/VAT → Debit/Credit" buttons that just fill
  the amount fields) — it never posts a companion line the way the other
  four journals' calculators do. `postDocument`'s balance check is the
  only thing enforcing correctness here, since there's no auto-generated
  balancing line either; the UI disables Save until debit = credit.

All five journals from the manual are now built: Cash Disbursement, Cash
Receipts, Sales on Account, Purchases on Account, General Journal.
- **General Ledger + Trial Balance** (`app/reports/general-ledger/`,
  `app/reports/trial-balance/`) — the first reports built on top of the
  five journals, and the payoff for `postDocument`'s balance guarantee:
  `lib/reports.ts` computes both from `LedgerEntry` directly, no separate
  balance-tracking table needed.
  - Both work in a "debit-positive" internal convention — a positive
    number always means a debit balance, negative means credit,
    regardless of the account's own `normalBalance`. This matters because
    a trial balance should show an account's *actual* sign (e.g. a bank
    overdraft on a normally-debit Cash account should show as a credit),
    not force it into a "designed" column.
  - Trial Balance has the manual's two modes: Year-to-Date (opening
    balance + everything ever posted up to a date — what should tie to
    the Balance Sheet) and Current Net Change (movement within a period
    only, no opening balance). The UI shows a live "debits equal credits"
    check — this should always be true across every account, since every
    document that ever posted through `postDocument()` was already
    balanced going in. If it's ever false, something bypassed the posting
    engine.
  - Caught and fixed a date-range bug while building this: filtering with
    `postingDate: { lt: dateTo }` on a date-only value (no time
    component) silently excludes every entry on the "to" day itself. Used
    `lte` instead, since `postingDate` is always stored at midnight from
    a date-only input.
- **Debtors' / Creditors' Ledger** (`app/reports/subsidiary-ledger/`) —
  a customer's or vendor's Accounts Receivable/Payable movements
  specifically, not every ledger line tagged with that party.
  `getSubsidiaryLedger()` filters by BOTH the party (`customerId` or
  `vendorId`) AND the account's `classification`
  (`ACCOUNTS_RECEIVABLE`/`ACCOUNTS_PAYABLE`) — without the classification
  filter, a Sales entry's Income line and AR line are both tagged with
  the same customer, and summing both would double-count rather than
  show what they actually owe. Structurally almost identical to
  `getGeneralLedger()` (same beginning-balance + running-balance shape),
  just keyed on a party instead of a single account, and able to span
  multiple AR/AP accounts for that party if more than one exists.
- **Income Statement / Balance Sheet** (`app/reports/income-statement/`,
  `app/reports/balance-sheet/`) — both derived from the same
  `getAccountNetMovements()` helper that `getTrialBalance()` uses, now
  extracted into a shared function since three reports needed it.
  - Income Statement is always period-based (Revenue/Expense are
    temporary accounts) — no opening balance folded in, ever.
  - Balance Sheet has a subtlety worth understanding before you touch it:
    this system never automates the real-world year-end "close" (zeroing
    Revenue/Expense into `EQUITY_GETS_CLOSED` via a General Journal
    entry). A naive Balance Sheet that only adds the *current* fiscal
    year's net income to Equity would fail to balance the moment a prior
    year's books haven't been closed — assets/liabilities are cumulative
    since inception, but a current-year-only earnings figure isn't.
    Fixed by computing net income twice — once since the earliest posted
    entry (all-time), once for just the current fiscal year — and
    showing the difference as its own "Prior years' unclosed earnings"
    line. This makes the sheet balance unconditionally (provided opening
    balances were themselves entered in a balanced way) while surfacing
    a real signal: a nonzero value there means "close your books for that
    year," not "this calculation is broken."
  - Both reports show a live balance check, same as Trial Balance — for
    Balance Sheet specifically, Assets = Liabilities + Equity should
    always hold given the above.

## Database and deployment

- **Local testing**: `docker-compose.yml` runs Postgres 16 locally.
  `.env.example` → `.env` already matches its credentials. See
  `DEPLOYMENT.md` for the full walkthrough (start Postgres → `npx prisma
  db push` → seed → run → first-time setup steps in the app itself).
- **`db push` vs. `migrate dev`**: this project uses `prisma db push` for
  now — it syncs the database to `schema.prisma` directly with no
  migration history, which is the right tool while the schema is still
  moving. `DEPLOYMENT.md` explains when to switch to `migrate dev`
  (multiple contributors, need for reviewable history, approaching a real
  production launch).
- **Vercel deployment**: needs a hosted Postgres (Vercel Postgres or
  Neon — use Neon's *pooled* connection string, since serverless
  functions open a new connection per request and exhaust an unpooled
  connection limit fast) and the `DATABASE_URL` environment variable set
  in the Vercel dashboard.
- **A real gotcha, fixed proactively**: `prisma generate` is wired into
  both `postinstall` and the `build` script. Skipping this is the single
  most common reason a Prisma+Vercel app deploys "successfully" and then
  500s on the first database call — Vercel caches `node_modules`, and if
  `generate` only ran once and the cache hits, the generated client can
  go stale against schema changes.
- **`.gitignore` was missing** until this stage — an oversight from the
  very first commit, since this project didn't have a real deployment
  target yet. Fixed now, before this goes anywhere near a real Git repo;
  double-check `git status` never shows `.env` before your first commit.

## BIR compliance reports

- **Monthly VAT Return** (`app/reports/bir/vat-return/`, BIR Form 2550M
  shape) — the first BIR-specific report, computed from `LedgerEntry`
  rather than the general-purpose queries in `lib/reports.ts`.
  - Deliberately mirrors a limitation stated in the manual itself, quoted
    directly: *"The system will only take up the current transactions as
    the basis of computing Vat Payable. Any adjustments coming from
    previous period will be manually encoded."* Rather than inventing
    carryover-tracking logic the source system doesn't have either,
    "Input Tax Carried Over from Previous Period" is a manual input field
    here too, exactly matching the original.
  - Splits Vatable Sales into Private vs. Government using
    `Customer.customerType` — this is exactly why that field exists.
  - **Known simplification, stated honestly rather than faked**: the
    manual's form splits purchases into Capital Goods / Goods / Services
    using a Tax Source captured at entry time. The schema already has
    this field (`LedgerEntry.taxSource`, the `GOODS`/`SERVICE`/
    `CAPITAL_GOODS` enum), but none of the four journal entry screens
    populate it yet — `VatComputationFields` doesn't currently ask for
    it. Until that's wired up, this report only reliably separates
    Capital Goods (via the debited account's `FIXED_ASSET`
    classification) from everything else, rather than presenting a
    Goods/Services split with no real data behind it.

None of these have auth wired up yet — every server component currently
does `prisma.company.findFirst()` rather than deriving the company from a
session. Each page has a `// TODO` marking this.

## Suggested folder structure

```
app/
├── (auth)/login/
├── dashboard/
├── company/setup/                ← 1.1 Setup Company            ✅ built
├── company/tax-posting-setup/    ← VAT/WHT posting accounts     ✅ built
├── accounts/                     ← 1.2 Chart of Accounts        ✅ built
├── agents/                       ← 1.3 Setup Agent              ✅ built
├── tools/vat-calculator/          ← standalone calculator demo   ✅ built
├── transactions/
│   ├── cash-disbursement/        ← 1.5                          ✅ built
│   ├── cash-receipts/            ← 1.6                          ✅ built
│   ├── sales/                    ← 1.7 (incl. Sales Return toggle)  ✅ built
│   ├── purchases/                 ← 1.8 (incl. Purchase Return toggle) ✅ built
│   └── general-journal/           ← 1.9                          ✅ built
├── reports/
│   ├── journals/                  ← per-journal reports
│   ├── ledgers/                   ← Debtors'/Creditors' + General Ledger ✅ both built (app/reports/subsidiary-ledger/, app/reports/general-ledger/)
│   ├── trial-balance/             ← Year-to-Date + Current Net Change   ✅ built (app/reports/trial-balance/)
│   └── financial-statements/      ← Worksheet → Income Statement, Balance Sheet ✅ both built (app/reports/income-statement/, app/reports/balance-sheet/)
├── bir/
│   ├── forms/                     ← 2550M/2550Q (VAT return) ✅ built (app/reports/bir/vat-return/); 1601E/1601F still open
│   ├── certificates/              ← 2307, 2306
│   ├── summaries/                  ← SLS/SLP
│   └── data-files/                 ← RELIEF/MAP export
└── api/
    ├── ledger-entries/route.ts    ← generic Transaction Summary query ✅ built
    ├── ledger-entries/cancel/     ← generic cancel endpoint      ✅ built
    ├── ledger-entries/cash-disbursement/ ← posting engine        ✅ built
    ├── ledger-entries/cash-receipts/     ← posting engine        ✅ built
    ├── ledger-entries/sales/             ← posting engine        ✅ built
    ├── ledger-entries/purchases/         ← posting engine        ✅ built
    ├── ledger-entries/general-journal/   ← posting engine        ✅ built
    ├── reports/trial-balance/            ← Trial Balance query   ✅ built
    ├── reports/general-ledger/           ← General Ledger query  ✅ built
    ├── reports/subsidiary-ledger/        ← Debtors'/Creditors' query ✅ built
    ├── reports/income-statement/         ← Income Statement query ✅ built
    ├── reports/balance-sheet/            ← Balance Sheet query   ✅ built
    └── reports/bir/vat-return/           ← Monthly VAT Return    ✅ built
```

## Business logic worth calling out (don't lose these in translation)

- **VAT math**: gross = net × 1.12 (or net = gross / 1.12), VAT = gross − net.
  This single calculation is reused across all five journals — build it
  once as a shared function, not five times.
- **Auto-numbering**: CV no., OR no., Invoice no., PV no., JV no. are all
  system-suggested but editable. Use a per-company, per-journal-type counter.
- **VAT-registration gating**: 12% VAT / Zero-Rated / VAT Exempt options
  should only appear if the counterparty's `registrationType` is `VAT`;
  otherwise force `NON_VAT`. Same rule for "Importation" — only offered
  when the payee/supplier is `NON_VAT` (assumed foreign).
- **Split VAT lines**: one expense/sales account can have two lines — one
  `VAT_12`, one `VAT_EXEMPT` — for a single transaction split partly taxable.
- **Multiple withholding lines**: government sales can carry two ATC/WHT
  rows against one gross amount (manual section on "Government Sale with
  multiple Withholding taxes") — this is exactly why `Customer.customerType`
  has a GOVERNMENT value.
- **Manual VAT closing entries**: closing Input Tax/Output Tax to VAT
  Payable is a plain General Journal entry with VAT-computation *declined*
  (the "No" prompt) — don't force the VAT popup on every Input/Output line.
- **Location vs. consolidation**: branches get their own `Location`, but
  virtually every report defaults to consolidated across locations — filter
  by location only when explicitly asked.
- **Periodic inventory**: this system does not track a running Inventory
  ledger; COGS is computed at period-end, not per-transaction. Don't build
  a perpetual-inventory model unless you intend to change that policy.
- **Decimal serialization**: any Prisma record with a `Decimal` field
  (`Account.openingBalance`, `AtcCode.ratePercent`, every monetary field
  on `LedgerEntry`) throws at runtime if passed directly as a prop from a
  Server Component to a Client Component — Decimal.js instances aren't
  in React's list of serializable types. Wrap with `toPlain()`
  (`lib/serialize.ts`) before passing down. Every future journal screen
  will hit this the moment it fetches accounts or ATC codes server-side.

## What to build next

The Monthly VAT Return (2550M/2550Q) is the first BIR form done. Test the
deployment (see `DEPLOYMENT.md`) before going further — everything past
this point builds on the assumption that posting and reporting actually
work end to end against a real database, not just in theory. After that:

1. Wire up `LedgerEntry.taxSource` (Goods/Service/Capital Goods) in the
   Cash Disbursement and Purchases entry screens — the VAT return's
   purchases split depends on it, and it's a schema field that already
   exists but nothing populates yet.
2. 1601E/1601F (withholding remittance) and the Monthly Alphalist of
   Payees — pulls from `LedgerEntry.atcCode`/`withholdingAmt`, grouped by
   vendor, structurally similar to the VAT return.
3. 2307/2306 certificates — per-transaction or per-quarter withholding
   certificates for a specific vendor/customer.
4. SLS/SLP (Summary Lists of Sales/Purchases) and the RELIEF/MAP data
   file export — these read the same underlying data as the VAT return
   but need a specific file format (BIR's DAT file layout) rather than
   an on-screen report.

## Deferred / known gaps

- Editing or deleting an already-posted document isn't built yet — only
  cancel (soft, via `isCancelled`). Editing a document that auto-generated
  Input VAT/Withholding companion lines means deleting and regenerating
  all of them, not just patching one row; worth designing deliberately
  rather than bolting on.
- Counterparty is currently attached to every "main" line plus the
  balancing cash line, but not to the auto-generated Input VAT/Withholding
  companion lines (those are impersonal control accounts). Revisit if you
  want per-vendor withholding remittance reports.
- Invoice numbers and Credit Memo numbers share the same numbering
  namespace right now (`documentNo` is unique per `companyId` +
  `journalType`, and Sales Returns post under `journalType:
  SALES_ON_ACCOUNT` same as regular invoices). The manual shows "Invoice
  no." and "CM No." as two visually separate fields, suggesting two
  independent sequences. Doesn't break double-entry correctness, but
  worth a dedicated `documentType`-aware uniqueness constraint if you
  want Invoice #1001 and CM #1001 to coexist.
