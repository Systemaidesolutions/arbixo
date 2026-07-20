import { notFound } from "next/navigation";
import { requirePostingCompany } from "@/lib/currentUser";
import { prisma } from "@/lib/prisma";
import { getSubsidiaryLedger } from "@/lib/reports";
import { formatPeso } from "@/lib/format";
import { PrintControls } from "@/components/PrintControls";
import { ReportHeader, ReportFooter } from "@/components/ReportHeader";

const bal = (n: number) => `${formatPeso(Math.abs(n))} ${n >= 0 ? "Dr" : "Cr"}`;

export default async function SubsidiaryLedgerPrintPage({
  searchParams,
}: {
  searchParams: { partyType?: string; partyId?: string; dateFrom?: string; dateTo?: string };
}) {
  const company = await requirePostingCompany();
  const partyType = searchParams.partyType === "VENDOR" ? "VENDOR" : "CUSTOMER";
  if (!company || !searchParams.partyId) notFound();

  const dateFrom = searchParams.dateFrom ?? `${new Date().getFullYear()}-01-01`;
  const dateTo = searchParams.dateTo ?? new Date().toISOString().slice(0, 10);

  const [ledger, party] = await Promise.all([
    getSubsidiaryLedger(company.id, partyType, searchParams.partyId, new Date(dateFrom), new Date(dateTo)),
    partyType === "CUSTOMER"
      ? prisma.customer.findUnique({ where: { id: searchParams.partyId } })
      : prisma.vendor.findUnique({ where: { id: searchParams.partyId } }),
  ]);

  const partyName = party ? party.tradeName || `${party.firstName ?? ""} ${party.lastName ?? ""}`.trim() : "";
  const fmtDate = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" });
  const title = partyType === "CUSTOMER" ? "Debtors' Ledger" : "Creditors' Ledger";
  const coverage = `${party ? `${party.code} — ${partyName}  ·  ` : ""}${fmtDate(dateFrom)} to ${fmtDate(dateTo)}`;
  const num = "px-1 py-1 text-right font-mono";

  return (
    <main className="mx-auto max-w-3xl bg-white p-6 text-neutral-900 print:p-0">
      <style>{`@media print { @page { size: A4; margin: 0.4in } html, body { height: auto !important; overflow: visible !important; } * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; } }`}</style>
      <PrintControls auto={false} />

      <ReportHeader company={company} title={title} coverage={coverage} />

      <table className="mt-4 w-full text-xs" style={{ printColorAdjust: "exact", WebkitPrintColorAdjust: "exact" }}>
        <thead>
          <tr className="border-b border-neutral-400 text-left uppercase tracking-wide text-neutral-600">
            <th className="px-1 py-1">Date</th>
            <th className="px-1 py-1">Journal</th>
            <th className="px-1 py-1">Doc no.</th>
            <th className="px-1 py-1">Account</th>
            <th className="px-1 py-1 text-right">Debit</th>
            <th className="px-1 py-1 text-right">Credit</th>
            <th className="px-1 py-1 text-right">Balance</th>
          </tr>
        </thead>
        <tbody>
          <tr className="font-semibold">
            <td colSpan={6} className="px-1 py-1">Beginning balance</td>
            <td className={num}>{bal(ledger.beginningBalance)}</td>
          </tr>
          {ledger.rows.length === 0 ? (
            <tr><td colSpan={7} className="py-4 text-center text-neutral-400">No entries for this period</td></tr>
          ) : (
            ledger.rows.map((r, i) => (
              <tr key={r.id} className={i % 2 === 1 ? "bg-neutral-50" : "bg-white"}>
                <td className="whitespace-nowrap px-1 py-1">{new Date(r.postingDate).toISOString().slice(0, 10)}</td>
                <td className="px-1 py-1 text-neutral-500">{r.journalType.replaceAll("_", " ")}</td>
                <td className="px-1 py-1 font-mono">{r.documentNo}</td>
                <td className="px-1 py-1 text-neutral-600">{r.accountCode} — {r.accountTitle}</td>
                <td className={num}>{r.debit > 0 ? formatPeso(r.debit) : ""}</td>
                <td className={num}>{r.credit > 0 ? formatPeso(r.credit) : ""}</td>
                <td className={num}>{bal(r.runningBalance)}</td>
              </tr>
            ))
          )}
          <tr className="border-t-2 border-neutral-800 font-bold">
            <td colSpan={6} className="px-1 py-1">Ending balance</td>
            <td className={num}>{bal(ledger.endingBalance)}</td>
          </tr>
        </tbody>
      </table>

      <ReportFooter />
    </main>
  );
}
