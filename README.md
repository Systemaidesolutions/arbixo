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
  posting engine which GL accounts to hit for Input VAT, Output VAT, and
  Withholding Tax Payable. The manual does this invisibly; here it's
  explicit and editable, same idea as BC's VAT Posting Setup.
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
  - A generic Transaction Summary query (`app/api/ledger-entries/route.ts`)
    and cancel endpoint (`app/api/ledger-entries/cancel/`) — both take a
    `journalType` parameter, so Cash Receipts/Sales/Purchases/General
    Journal reuse them without writing new endpoints.
  - `<CounterpartyPicker>` (`components/`) — Vendor/Employee/Contact/
    Customer selector, needed because `LedgerEntry` has four separate FKs
    instead of one `Agent`.

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
│   ├── cash-receipts/            ← 1.6
│   ├── sales/                    ← 1.7 (incl. Sales Return toggle)
│   ├── purchases/                 ← 1.8 (incl. Purchase Return toggle)
│   └── general-journal/           ← 1.9
├── reports/
│   ├── journals/                  ← per-journal reports
│   ├── ledgers/                   ← Debtors'/Creditors' + General Ledger
│   ├── trial-balance/             ← Year-to-Date + Current Net Change
│   └── financial-statements/      ← Worksheet → Income Statement, Balance Sheet
├── bir/
│   ├── forms/                     ← 2550M/2550Q, 1601E/1601F
│   ├── certificates/              ← 2307, 2306
│   ├── summaries/                  ← SLS/SLP
│   └── data-files/                 ← RELIEF/MAP export
└── api/
    ├── ledger-entries/route.ts    ← generic Transaction Summary query ✅ built
    ├── ledger-entries/cancel/     ← generic cancel endpoint      ✅ built
    ├── ledger-entries/cash-disbursement/ ← posting engine        ✅ built
    └── reports/*/route.ts
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

1. Cash Receipts — the mirror image of Cash Disbursement (Output VAT
   instead of Input VAT, Customer instead of Vendor). Should reuse
   `postDocument`, `<VatComputationFields>`, and `<CounterpartyPicker>`
   almost unchanged.
2. Sales on Account / Purchases on Account — same building blocks, but
   the balancing line hits Accounts Receivable/Payable instead of Cash.
3. General Ledger + Trial Balance reports (straight aggregation queries
   over `LedgerEntry` — `postDocument`'s balance guarantee is what makes
   these trustworthy).
4. BIR forms last — they're PDF-shaped reports that read from the same
   ledger data, once everything else works.

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
