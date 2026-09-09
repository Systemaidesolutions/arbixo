import { notFound } from "next/navigation";
import { requirePostingCompany } from "@/lib/currentUser";
import { getCustomerBalanceDetailAll } from "@/lib/customerBalances";
import { formatPeso, formatDate } from "@/lib/format";
import { PrintControls } from "@/components/PrintControls";
import { ReportHeader, ReportFooter } from "@/components/ReportHeader";

export const maxDuration = 60;

export default async function CustomerBalanceDetailAllPrintPage() {
  const company = await requirePostingCompany();
  if (!company) notFound();

  const th = "border border-neutral-400 px-1 py-0.5 text-center align-middle font-semibold";
  const td = "border border-neutral-300 px-1 py-0.5 align-top";
  const tdNum = `${td} text-right font-mono whitespace-nowrap`;

  const { groups, grandTotal } = await getCustomerBalanceDetailAll(company.id);

  return (
    <main className="mx-auto max-w-[8.5in] bg-white p-6 text-neutral-900 print:p-0">
      <style>{`@media print { @page { size: A4; margin: 0.4in } html, body { height: auto !important; overflow: visible !important; } * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; } }`}</style>
      <PrintControls auto={false} />
      <ReportHeader company={company} title="Customer Balance Detail Report" coverage="All Dates" />
      {groups.length === 0 ? (
        <p className="mt-6 text-center text-sm text-neutral-400">No open balances</p>
      ) : (
        <div className="mt-4 space-y-4">
          {groups.map((g) => (
            <div key={g.customerId}>
              <div className="bg-neutral-100 px-1 py-1 text-[10px] font-bold">{g.customerName}</div>
              <table className="w-full border-collapse text-[9px]" style={{ printColorAdjust: "exact", WebkitPrintColorAdjust: "exact" }}>
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
                  {g.rows.map((r) => (
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
                  ))}
                </tbody>
                <tfoot>
                  <tr className="font-bold">
                    <td className={td} colSpan={7}>Subtotal</td>
                    <td className={tdNum}>{formatPeso(g.subtotal)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ))}
          <table className="w-full border-collapse text-[9px]">
            <tfoot>
              <tr className="font-bold">
                <td className={`${td} border-2`} style={{ width: "87.5%" }}>TOTAL</td>
                <td className={`${tdNum} border-2`}>{formatPeso(grandTotal)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
      <ReportFooter />
    </main>
  );
}
