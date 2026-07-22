import { notFound } from "next/navigation";
import { requirePostingCompany } from "@/lib/currentUser";
import { getSalesSubsidiaryJournal } from "@/lib/salesSubsidiaryJournal";
import { resolveBranchScope, branchScopeLabel } from "@/lib/branchScope";
import { formatPeso } from "@/lib/format";
import { PrintControls } from "@/components/PrintControls";
import { ReportHeader, ReportFooter } from "@/components/ReportHeader";

export default async function SalesSubsidiaryJournalPrintPage({
  searchParams,
}: {
  searchParams: { from?: string; to?: string; locationId?: string };
}) {
  const company = await requirePostingCompany();
  if (!company) notFound();

  const from = searchParams.from ?? `${new Date().getFullYear()}-01-01`;
  const to = searchParams.to ?? new Date().toISOString().slice(0, 10);
  const branch = await resolveBranchScope(company.id, searchParams.locationId);
  const data = await getSalesSubsidiaryJournal(company.id, new Date(`${from}T00:00:00`), new Date(`${to}T23:59:59.999`), branch);

  const fmt = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" });
  let coverage = `For the period ${fmt(from)} to ${fmt(to)}`;
  if (branch) coverage = `${coverage} · Branch: ${await branchScopeLabel(branch)}`;
  const rowDate = (d: string) => new Date(d).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" });
  const num = (v: number) => (v ? formatPeso(v) : "");
  const cashTotal = data.rows.filter((r) => r.terms === "Cash").reduce((s, r) => s + r.totalInvoice, 0);
  const acctTotal = data.rows.filter((r) => r.terms === "Account").reduce((s, r) => s + r.totalInvoice, 0);

  const th = "border border-neutral-400 px-1 py-0.5 text-center align-middle font-semibold";
  const td = "border border-neutral-300 px-1 py-0.5 align-top";
  const tdNum = `${td} text-right font-mono whitespace-nowrap`;

  return (
    <main className="mx-auto max-w-[10.6in] bg-white p-6 text-neutral-900 print:p-0">
      <style>{`@media print { @page { size: A4 landscape; margin: 0.3in } html, body { height: auto !important; overflow: visible !important; } * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; } }`}</style>
      <PrintControls auto={false} />

      <ReportHeader company={company} title="Sales Subsidiary Journal" coverage={coverage} />

      <table className="mt-4 w-full border-collapse text-[8px]" style={{ printColorAdjust: "exact", WebkitPrintColorAdjust: "exact" }}>
        <thead>
          <tr>
            <th className={th} rowSpan={2}>Date</th>
            <th className={th} rowSpan={2}>Name and Address of Buyers</th>
            <th className={th} rowSpan={2}>F</th>
            <th className={th} rowSpan={2}>Invoice Numbers</th>
            <th className={th} rowSpan={2}>VAT Reg. No.</th>
            <th className={th}>Sales</th>
            <th className={th} colSpan={2}>Taxable Sales</th>
            <th className={th} rowSpan={2}>VAT Output Tax</th>
            <th className={th} rowSpan={2}>Total Invoice Amount</th>
            <th className={th} colSpan={2}>Classification of Sales</th>
            <th className={th} colSpan={2}>Terms</th>
          </tr>
          <tr>
            <th className={th}>Exempted</th>
            <th className={th}>12%</th>
            <th className={th}>Zero Rated</th>
            <th className={th}>Local</th>
            <th className={th}>Service</th>
            <th className={th}>Cash</th>
            <th className={th}>Account</th>
          </tr>
        </thead>
        <tbody>
          {data.rows.length === 0 ? (
            <tr><td className={`${td} text-center text-neutral-400`} colSpan={14}>No sales in this period</td></tr>
          ) : (
            data.rows.map((r) => (
              <tr key={r.key}>
                <td className={`${td} whitespace-nowrap`}>{rowDate(r.postingDate)}</td>
                <td className={td}>
                  <div className="font-medium">{r.buyerName || "—"}</div>
                  {r.buyerAddress ? <div className="text-neutral-500">{r.buyerAddress}</div> : null}
                </td>
                <td className={td} />
                <td className={`${td} font-mono`}>{r.documentNo}</td>
                <td className={`${td} font-mono`}>{r.vatRegNo || "—"}</td>
                <td className={tdNum}>{num(r.exempt)}</td>
                <td className={tdNum}>{num(r.vatable12)}</td>
                <td className={tdNum}>{num(r.zeroRated)}</td>
                <td className={tdNum}>{num(r.outputTax)}</td>
                <td className={tdNum}>{num(r.totalInvoice)}</td>
                <td className={tdNum}>{num(r.local)}</td>
                <td className={tdNum}>{num(r.service)}</td>
                <td className={tdNum}>{r.terms === "Cash" ? num(r.totalInvoice) : ""}</td>
                <td className={tdNum}>{r.terms === "Account" ? num(r.totalInvoice) : ""}</td>
              </tr>
            ))
          )}
        </tbody>
        <tfoot>
          <tr className="font-bold">
            <td className={td} colSpan={5}>TOTAL</td>
            <td className={tdNum}>{num(data.totals.exempt)}</td>
            <td className={tdNum}>{num(data.totals.vatable12)}</td>
            <td className={tdNum}>{num(data.totals.zeroRated)}</td>
            <td className={tdNum}>{num(data.totals.outputTax)}</td>
            <td className={tdNum}>{num(data.totals.totalInvoice)}</td>
            <td className={tdNum}>{num(data.totals.local)}</td>
            <td className={tdNum}>{num(data.totals.service)}</td>
            <td className={tdNum}>{num(cashTotal)}</td>
            <td className={tdNum}>{num(acctTotal)}</td>
          </tr>
        </tfoot>
      </table>

      <ReportFooter orientation="landscape" marginIn={0.3} />
    </main>
  );
}
