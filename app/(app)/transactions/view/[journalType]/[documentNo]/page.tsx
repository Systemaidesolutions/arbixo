import { notFound } from "next/navigation";
import { requirePostingCompany, getCurrentCapability } from "@/lib/currentUser";
import { prisma } from "@/lib/prisma";
import { formatPeso } from "@/lib/format";
import { branchOptionLabel } from "@/lib/branchLabel";
import { TransactionActions } from "@/components/TransactionActions";
import { listAttachments } from "@/lib/transactionAttachments";
import type { JournalType } from "@prisma/client";

const fileSize = (n: number | null) =>
  n == null ? "" : n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(0)} KB` : `${(n / 1048576).toFixed(1)} MB`;

// The Check-Voucher / Purchase-Voucher print format only applies to money-out
// documents, so the detail view offers "Print voucher" for just these two.
const PRINTABLE: JournalType[] = ["CASH_DISBURSEMENT", "PURCHASE_ON_ACCOUNT"];
// Money-out journals where the company withholds and issues a BIR 2307.
const PRINTABLE_2307: JournalType[] = ["CASH_DISBURSEMENT", "PURCHASE_ON_ACCOUNT"];

// Read-only detail view of a posted transaction — the "open the transaction"
// target for the search results (as opposed to the printable voucher). Opens
// chrome-less with ?_embed=1 (see AppShell).
const META: Record<JournalType, { title: string; partyLabel: string; docLabel: string }> = {
  CASH_RECEIPT: { title: "Cash Receipt", partyLabel: "Payor", docLabel: "OR no." },
  CASH_DISBURSEMENT: { title: "Cash Disbursement", partyLabel: "Payee", docLabel: "CV no." },
  SALES_ON_ACCOUNT: { title: "Sales on Account", partyLabel: "Customer", docLabel: "Invoice no." },
  PURCHASE_ON_ACCOUNT: { title: "Purchase on Account", partyLabel: "Supplier", docLabel: "PV no." },
  GENERAL_JOURNAL: { title: "General Journal", partyLabel: "Party", docLabel: "JV no." },
};

export default async function TransactionViewPage({ params }: { params: { journalType: string; documentNo: string } }) {
  const company = await requirePostingCompany();
  if (!company) notFound();

  const journalType = params.journalType as JournalType;
  const meta = META[journalType];
  if (!meta) notFound();

  const documentNo = decodeURIComponent(params.documentNo);
  const entries = await prisma.ledgerEntry.findMany({
    where: { companyId: company.id, journalType, documentNo },
    include: { account: true, customer: true, vendor: true, employee: true, contact: true, location: true },
    orderBy: { lineNo: "asc" },
  });
  if (entries.length === 0) notFound();

  const first = entries[0];
  const withParty = entries.find((e) => e.customer || e.vendor || e.employee || e.contact);
  const p = withParty?.customer || withParty?.vendor || withParty?.contact;
  const partyName =
    p?.registeredName || p?.tradeName ||
    (withParty?.employee ? [withParty.employee.firstName, withParty.employee.middleName, withParty.employee.lastName].filter(Boolean).join(" ") : null) ||
    [p?.lastName, p?.firstName].filter(Boolean).join(", ") || "—";
  const checkNo = entries.find((e) => e.checkNo)?.checkNo ?? "";
  const paymentTerms = entries.find((e) => e.paymentTerms)?.paymentTerms ?? "";
  const dueDate = entries.find((e) => e.dueDate)?.dueDate ?? null;

  const capability = await getCurrentCapability();
  const cancellationReason = entries.find((e) => e.cancellationReason)?.cancellationReason ?? "";
  const attachments = (await listAttachments(company.id, journalType, [documentNo]))[documentNo] ?? [];

  const totalNet = entries.reduce((s, e) => s + Number(e.netAmount ?? 0), 0);
  const totalVat = entries.reduce((s, e) => s + Number(e.vatAmount ?? 0), 0);
  const totalWtax = entries.reduce((s, e) => s + Number(e.withholdingAmt ?? 0), 0);
  const totalDebit = entries.reduce((s, e) => s + Number(e.debitAmount), 0);
  const totalCredit = entries.reduce((s, e) => s + Number(e.creditAmount), 0);

  const cell = "border-b border-neutral-100 px-2 py-1.5 align-top";
  const num = (v: number) => (v ? formatPeso(v) : "—");

  const info: [string, string][] = [
    [meta.docLabel, documentNo],
    ["Date", new Date(first.postingDate).toLocaleDateString()],
    [meta.partyLabel, partyName],
    ["Branch", first.location ? branchOptionLabel(first.location) : "—"],
  ];
  if (journalType === "CASH_DISBURSEMENT") info.push(["Check no.", checkNo || "—"]);
  if (paymentTerms) info.push(["Payment terms", paymentTerms]);
  if (dueDate) info.push(["Due date", new Date(dueDate).toLocaleDateString()]);

  return (
    <main className="mx-auto max-w-5xl p-4 sm:p-8">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-medium text-neutral-900">{meta.title}</h1>
          <p className="mt-1 font-mono text-sm text-neutral-500">
            {documentNo}
            {first.isCancelled && <span className="ml-2 rounded bg-red-100 px-1.5 py-0.5 text-xs font-medium text-red-700">Cancelled</span>}
            {first.isReturn && <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-700">Return</span>}
          </p>
        </div>
        <TransactionActions
          companyId={company.id}
          journalType={journalType}
          documentNo={documentNo}
          isCancelled={first.isCancelled}
          canCancel={Boolean(capability?.canCancel)}
          showPrint={PRINTABLE.includes(journalType)}
          show2307={PRINTABLE_2307.includes(journalType)}
        />
      </div>

      {first.isCancelled && cancellationReason && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span className="font-medium">Cancelled.</span> {cancellationReason}
        </div>
      )}

      {/* Header info */}
      <div className="mt-6 grid grid-cols-2 gap-x-6 gap-y-3 rounded-lg border border-neutral-200 p-4 text-sm sm:grid-cols-3">
        {info.map(([k, v]) => (
          <div key={k}>
            <div className="text-xs text-neutral-400">{k}</div>
            <div className="text-neutral-900">{v}</div>
          </div>
        ))}
      </div>

      {/* Lines */}
      <div className="mt-6 overflow-x-auto rounded-lg border border-neutral-200">
        <table className="w-full min-w-[720px] text-xs">
          <thead>
            <tr className="bg-neutral-50 text-left text-neutral-500">
              <th className={cell}>Account</th>
              <th className={cell}>Ref No.</th>
              <th className={cell}>Description</th>
              <th className={`${cell} text-right`}>Net</th>
              <th className={`${cell} text-right`}>VAT</th>
              <th className={`${cell} text-right`}>W/tax</th>
              <th className={`${cell} text-right`}>Debit</th>
              <th className={`${cell} text-right`}>Credit</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.id}>
                <td className={cell}>{e.account.code} — {e.account.title}</td>
                <td className={`${cell} font-mono`}>{e.referenceNo || "—"}</td>
                <td className={cell}>{e.lineDescription || "—"}</td>
                <td className={`${cell} text-right font-mono`}>{num(Number(e.netAmount ?? 0))}</td>
                <td className={`${cell} text-right font-mono`}>{num(Number(e.vatAmount ?? 0))}</td>
                <td className={`${cell} text-right font-mono`}>{num(Number(e.withholdingAmt ?? 0))}</td>
                <td className={`${cell} text-right font-mono`}>{num(Number(e.debitAmount))}</td>
                <td className={`${cell} text-right font-mono`}>{num(Number(e.creditAmount))}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-neutral-50 font-medium">
              <td className={cell} colSpan={3}>Totals</td>
              <td className={`${cell} text-right font-mono`}>{formatPeso(totalNet)}</td>
              <td className={`${cell} text-right font-mono`}>{formatPeso(totalVat)}</td>
              <td className={`${cell} text-right font-mono`}>{formatPeso(totalWtax)}</td>
              <td className={`${cell} text-right font-mono`}>{formatPeso(totalDebit)}</td>
              <td className={`${cell} text-right font-mono`}>{formatPeso(totalCredit)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Attachments */}
      <div className="mt-6">
        <h2 className="text-sm font-medium text-neutral-900">Attachments</h2>
        {attachments.length === 0 ? (
          <p className="mt-2 text-sm text-neutral-500">No files attached to this transaction.</p>
        ) : (
          <ul className="mt-2 flex flex-wrap gap-2">
            {attachments.map((a) => (
              <li key={a.id}>
                <a
                  href={`/api/transactions/attachments/${a.id}`}
                  download
                  className="flex items-center gap-2 rounded border border-neutral-200 bg-neutral-50 px-3 py-1.5 text-xs text-brand-blue hover:bg-blue-50"
                >
                  <span aria-hidden>📎</span>
                  <span className="max-w-[220px] truncate">{a.fileName}</span>
                  {a.sizeBytes != null && <span className="text-neutral-400">{fileSize(a.sizeBytes)}</span>}
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>

      <TransactionActions
        companyId={company.id}
        journalType={journalType}
        documentNo={documentNo}
        isCancelled={first.isCancelled}
        canCancel={Boolean(capability?.canCancel)}
        showPrint={PRINTABLE.includes(journalType)}
        show2307={PRINTABLE_2307.includes(journalType)}
        placement="bottom"
      />
    </main>
  );
}
