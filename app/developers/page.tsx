import Link from "next/link";
import { KeyRound, FileJson, SendHorizonal, Search, ListTree, Building2 } from "lucide-react";

export const metadata = {
  title: "Arbixo Integration API",
  description: "Documentation for the Arbixo external integration API — post and read a company's books from your own system.",
};

const code = "block overflow-x-auto rounded-lg bg-neutral-900 p-4 text-xs leading-relaxed text-neutral-100";
const h2 = "mt-12 text-lg font-semibold text-neutral-900";
const h3 = "mt-6 text-sm font-semibold text-neutral-800";
const p = "mt-2 text-sm leading-relaxed text-neutral-600";
const field = "font-mono text-[13px] text-brand-blue";

function Section({ icon: Icon, title, children }: { icon: typeof KeyRound; title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <div className="flex items-center gap-2">
        <Icon className="h-5 w-5 text-brand-blue" />
        <h2 className="text-lg font-semibold text-neutral-900">{title}</h2>
      </div>
      {children}
    </section>
  );
}

export default function DevelopersPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12 sm:px-8">
      <Link href="/" className="text-sm font-medium text-brand-blue">← Arbixo</Link>
      <h1 className="mt-4 text-3xl font-bold text-neutral-900">Integration API</h1>
      <p className={p}>
        Post journal entries from your own system straight into an Arbixo company&apos;s books, and read back what was
        posted — without a logged-in user. Built for systems that keep their own detailed records (e.g. a core banking
        or member-management system) and send Arbixo only the general-ledger totals to book and report on.
      </p>
      <p className={p}>
        This page is public and needs no Arbixo account — share it with whoever is integrating. Posting or reading
        data still requires a valid API key for the specific company (see Authentication below).
      </p>

      <Section icon={KeyRound} title="Authentication">
        <p className={p}>
          Every request needs an API key, scoped to one company, sent as a bearer token:
        </p>
        <pre className={code}>{`Authorization: Bearer arbx_live_xxxxxxxxxxxxxxxxxxxxxxxx`}</pre>
        <p className={p}>
          A Manager on the Arbixo account generates a key from <span className={field}>Setup → API Access</span> inside
          the app. The key is shown once, at creation — Arbixo never stores or displays the plaintext again, only a
          prefix for identification. Treat it like a password: anyone holding it can post to that company&apos;s books.
          A key can be revoked at any time from the same page, which takes effect immediately.
        </p>
        <p className={p}>
          A missing, malformed, or revoked key gets <span className={field}>401 Unauthorized</span>.
        </p>
      </Section>

      <Section icon={Building2} title="Base URL">
        <pre className={code}>{`https://www.arbixo.net/api/v1`}</pre>
        <p className={p}>All endpoints below are relative to this base. Every response is JSON.</p>
      </Section>

      <Section icon={SendHorizonal} title="POST /journal-entries — submit a batch">
        <p className={p}>
          Submits one or more journal entries. Each entry needs at least two lines whose debits and credits balance.
          Account codes are matched against the company&apos;s own chart of accounts (see{" "}
          <span className={field}>GET /accounts</span> below) — case-insensitive, exact match.
        </p>
        <h3 className={h3}>Request</h3>
        <pre className={code}>{`POST /api/v1/journal-entries
Authorization: Bearer arbx_live_...
Content-Type: application/json

{
  "entries": [
    {
      "documentNo": "BUPCC-2026-11-11",
      "date": "2026-11-11",
      "branchCode": "00000",
      "particulars": "Daily GL batch for 2026-11-11",
      "lines": [
        { "accountCode": "10100", "debit": 125000.00, "description": "Cash collections" },
        { "accountCode": "25100", "credit": 90000.00, "description": "Savings deposits" },
        { "accountCode": "25200", "credit": 35000.00, "description": "Time deposits" }
      ]
    }
  ]
}`}</pre>
        <h3 className={h3}>Fields</h3>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-neutral-600">
          <li><span className={field}>documentNo</span> — your own reference for this entry (e.g. a per-day batch id). Must be unique within this company&apos;s General Journal, permanently — resubmitting the same value is rejected, so a day can never be posted twice.</li>
          <li><span className={field}>date</span> — posting date, <span className={field}>YYYY-MM-DD</span>.</li>
          <li><span className={field}>branchCode</span> — optional. Must match a branch already set up in Arbixo (see <span className={field}>GET /branches</span>).</li>
          <li><span className={field}>particulars</span> — optional free-text memo for the entry as a whole.</li>
          <li><span className={field}>lines[].accountCode</span> — required, must exist in the company&apos;s chart of accounts.</li>
          <li><span className={field}>lines[].debit</span> / <span className={field}>credit</span> — exactly one of the two per line, greater than zero.</li>
          <li><span className={field}>lines[].description</span>, <span className={field}>partyType</span> (<span className={field}>CUSTOMER</span> / <span className={field}>VENDOR</span> / <span className={field}>EMPLOYEE</span> / <span className={field}>CONTACT</span>), <span className={field}>partyName</span> — all optional.</li>
        </ul>
        <h3 className={h3}>Response</h3>
        <pre className={code}>{`200 OK
{
  "results": [
    { "documentNo": "BUPCC-2026-11-11", "status": "posted" }
  ],
  "posted": 1,
  "failed": 0
}`}</pre>
        <p className={p}>
          Each entry in the batch is validated and posted independently — one bad entry doesn&apos;t block the rest.
          A failed entry reports why:
        </p>
        <pre className={code}>{`{
  "results": [
    { "documentNo": "BUPCC-2026-11-11", "status": "failed", "error": "Document number \\"BUPCC-2026-11-11\\" is already used in this journal" }
  ],
  "posted": 0,
  "failed": 1
}`}</pre>
        <p className={p}>
          Common rejection reasons: an unrecognized account code, debits and credits that don&apos;t balance, a
          duplicate <span className={field}>documentNo</span>, or a posting date outside a period the company has an
          active subscription for.
        </p>
      </Section>

      <Section icon={Search} title="GET /journal-entries/{documentNo} — check a batch's status">
        <p className={p}>Confirms whether a previously submitted entry was received and posted.</p>
        <pre className={code}>{`GET /api/v1/journal-entries/BUPCC-2026-11-11
Authorization: Bearer arbx_live_...

200 OK
{
  "documentNo": "BUPCC-2026-11-11",
  "status": "posted",
  "postingDate": "2026-11-11T00:00:00.000Z",
  "lines": [
    { "accountCode": "10100", "accountTitle": "Cash on Hand", "debit": 125000, "credit": 0, "description": "Cash collections" },
    { "accountCode": "25100", "accountTitle": "Savings Deposits", "debit": 0, "credit": 90000, "description": "Savings deposits" },
    { "accountCode": "25200", "accountTitle": "Time Deposits", "debit": 0, "credit": 35000, "description": "Time deposits" }
  ]
}`}</pre>
        <p className={p}>
          <span className={field}>status</span> is <span className={field}>posted</span>,{" "}
          <span className={field}>cancelled</span> (reversed in Arbixo after posting), or a{" "}
          <span className={field}>404</span> with <span className={field}>status: "not_found"</span> if that
          document number was never posted.
        </p>
      </Section>

      <Section icon={ListTree} title="GET /accounts — the company's chart of accounts">
        <p className={p}>Use this to map or validate your own account codes before sending a batch.</p>
        <pre className={code}>{`GET /api/v1/accounts
Authorization: Bearer arbx_live_...

200 OK
{
  "accounts": [
    { "code": "10100", "title": "Cash on Hand", "classification": "CASH_ON_HAND" },
    { "code": "25100", "title": "Savings Deposits", "classification": "OTHER_CURRENT_LIABILITY" }
  ]
}`}</pre>
      </Section>

      <Section icon={FileJson} title="GET /branches — the company's registered branches">
        <pre className={code}>{`GET /api/v1/branches
Authorization: Bearer arbx_live_...

200 OK
{
  "branches": [
    { "name": "Head Office", "branchCode": "00000", "isDefault": true }
  ]
}`}</pre>
      </Section>

      <Section icon={KeyRound} title="Notes">
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-neutral-600">
          <li>All amounts are plain numbers in PHP, no currency symbol or thousands separators.</li>
          <li>Posting respects the company&apos;s subscription coverage per calendar month — you can still post into a month that was already paid for, even if the current month hasn&apos;t been renewed yet.</li>
          <li>There is currently no webhook/push notification for batch status — poll <span className={field}>GET /journal-entries/{"{documentNo}"}</span> if you need confirmation beyond the immediate POST response.</li>
          <li>Rate limits aren&apos;t enforced yet; please keep batches to a reasonable size (one day&apos;s entries at a time).</li>
        </ul>
      </Section>
    </main>
  );
}
