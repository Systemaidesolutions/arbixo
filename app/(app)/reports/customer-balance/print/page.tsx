import { notFound } from "next/navigation";
import { requirePostingCompany } from "@/lib/currentUser";
import { getCustomerBalanceSummary, getCustomerBalanceDetail } from "@/lib/customerBalances";
import { formatPeso, formatDate } from "@/lib/format";
import { PrintControls } from "@/components/PrintControls";
import { ReportHeader, ReportFooter } from "@/components/ReportHeader";

export const maxDuration = 60;

export default async function CustomerBalancePrintPage({
  searchParams,
}: {
  searchParams: { customerId?: string };
}) {
  const company = await requirePostingCompany();
  if (!company) notFound();

  const th = "border border-neutral-400 px-1 py-0.5 text-center align-middle font-semibold";
  const td = "border border-neutral-300 px-1 py-0.5 align-top";
  const tdNum = `${td} text-right font-mono whitespace-nowrap`;

  if (searchParams.customerId) {
    const detail = await getCustomerBalanceDetail(company.id, searchParams.customerId);
    return (
      <main className="mx-auto max-w-[8.5in] bg-white p-6 text-neutral-900 print:p-0">
        <style>{`@media print { @page { size: A4; margin: 0.4in } html, body { height: auto !important; overflow: visible !important; } * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; } }`}</style>
        <PrintControls auto={false} />
        <ReportHeader company={company} title={`${detail.customerName} — Customer Balance Detail Report`} coverage="All Dates" />
        <table className="mt-4 w-full border-collapse text-[9px]" style={{ printColorAdjust: "exact", WebkitPrintColorAdjust: "exact" }}>
          <thead>
            <tr>
              <th className={th}>Date</th>
              <th className={th}>Transaction type</th>
              <th className={th}>Number</th>
              <th className={th}>Location</th>
              <th className={th}>Due date</th>
              <th className={th}>Amount</th>
              <th className={th}>Open balance</th>
              <th className={th}>Balance</th>
            </tr>
          </thead>
          <tbody>
            {detail.rows.length === 0 ? (
              <tr><td className={`${td} text-center text-neutral-400`} colSpan={8}>No open balance</td></tr>
            ) : (
              detail.rows.map((r) => (
                <tr key={r.documentNo}>
                  <td className={`${td} whitespace-nowrap`}>{formatDate(r.postingDate)}</td>
                  <td className={td}>{r.transactionType}</td>
                  <td className={`${td} font-mono`}>{r.documentNo}</td>
                  <td className={td}>{r.locationName ?? "—"}</td>
                  <td className={td}>{r.dueDate ? formatDate(r.dueDate) : "—"}</td>
                  <td className={tdNum}>{formatPeso(r.amount)}</td>
                  <td className={tdNum}>{formatPeso(r.openBalance)}</td>
                  <td className={tdNum}>{formatPeso(r.balance)}</td>
                </tr>
              ))
            )}
          </tbody>
          <tfoot>
            <tr className="font-bold">
              <td className={td} colSpan={7}>Total</td>
              <td className={tdNum}>{formatPeso(detail.totalBalance)}</td>
            </tr>
          </tfoot>
        </table>
        <ReportFooter />
      </main>
    );
  }

  const summary = await getCustomerBalanceSummary(company.id);
  const total = summary.reduce((s, r) => s + r.balance, 0);
  return (
    <main className="mx-auto max-w-[8.5in] bg-white p-6 text-neutral-900 print:p-0">
      <style>{`@media print { @page { size: A4; margin: 0.4in } html, body { height: auto !important; overflow: visible !important; } * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; } }`}</style>
      <PrintControls auto={false} />
      <ReportHeader company={company} title="Customer Balance Summary" coverage="All Dates" />
      <table className="mt-4 w-full border-collapse text-xs" style={{ printColorAdjust: "exact", WebkitPrintColorAdjust: "exact" }}>
        <thead>
          <tr>
            <th className={th}>Customer</th>
            <th className={th}>Total</th>
          </tr>
        </thead>
        <tbody>
          {summary.length === 0 ? (
            <tr><td className={`${td} text-center text-neutral-400`} colSpan={2}>No open balances</td></tr>
          ) : (
            summary.map((r) => (
              <tr key={r.customerId}>
                <td className={td}>{r.name}</td>
                <td className={tdNum}>{formatPeso(r.balance)}</td>
              </tr>
            ))
          )}
        </tbody>
        <tfoot>
          <tr className="font-bold">
            <td className={td}>TOTAL</td>
            <td className={tdNum}>{formatPeso(total)}</td>
          </tr>
        </tfoot>
      </table>
      <ReportFooter />
    </main>
  );
}
