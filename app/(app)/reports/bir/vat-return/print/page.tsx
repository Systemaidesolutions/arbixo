import { notFound } from "next/navigation";
import { requirePostingCompany } from "@/lib/currentUser";
import { getMonthlyVatReturn } from "@/lib/bir";
import { formatPeso } from "@/lib/format";
import { PrintControls } from "@/components/PrintControls";
import { ReportHeader, ReportFooter } from "@/components/ReportHeader";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

// Print-preview of the VAT Return (BIR Form 2550M shape). Carried-over input
// tax (line 17A) is a manual adjustment on the client, passed through here.
export default async function VatReturnPrintPage({
  searchParams,
}: {
  searchParams: { year?: string; month?: string; carryover?: string };
}) {
  const company = await requirePostingCompany();
  if (!company) notFound();

  const now = new Date();
  const year = Number(searchParams.year) || now.getFullYear();
  const month = Number(searchParams.month) || now.getMonth() + 1;
  const carryover = Number(searchParams.carryover) || 0;

  const data = await getMonthlyVatReturn(company.id, year, month);
  const totalAllowableInputTax = Math.max(0, data.totalCurrentInputTax + carryover);
  const vatPayable = round2(data.outputTax - totalAllowableInputTax);
  const excessInputTax = vatPayable < 0 ? round2(-vatPayable) : 0;

  const coverage = `For the month of ${MONTHS[month - 1]} ${year}`;
  const num = "py-1 pr-2 text-right font-mono";
  const zebra = (i: number) => (i % 2 === 1 ? "bg-neutral-50" : "bg-white");

  return (
    <main className="mx-auto max-w-2xl bg-white p-6 text-neutral-900 print:p-0">
      <style>{`@media print { html, body { height: auto !important; overflow: visible !important; } * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; } }`}</style>
      <PrintControls auto={false} />

      <ReportHeader company={company} title="VAT Return" coverage={coverage} />

      <table className="mt-4 w-full text-sm" style={{ printColorAdjust: "exact", WebkitPrintColorAdjust: "exact" }}>
        <tbody>
          {/* Sales / receipts */}
          <tr><td colSpan={2} className="pt-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">Sales/receipts for the month</td></tr>
          {[
            ["12A. Vatable sales/receipts — Private", data.vatableSalesPrivate],
            ["13. Sales to Government", data.salesToGovernment],
            ["14. Zero-rated sales/receipts", data.zeroRatedSales],
            ["15. Exempt sales/receipts", data.exemptSales],
          ].map(([label, amt], i) => (
            <tr key={label as string} className={zebra(i)}>
              <td className="py-1 pl-4 pr-2">{label}</td>
              <td className={num}>{formatPeso(amt as number)}</td>
            </tr>
          ))}
          <tr className="font-semibold">
            <td className="border-t border-neutral-300 py-1 pr-2">16A. Total sales/receipts</td>
            <td className={`border-t border-neutral-300 ${num}`}>{formatPeso(data.totalSales)}</td>
          </tr>
          <tr className="font-semibold">
            <td className="py-1 pr-2">16B. Output tax due</td>
            <td className={num}>{formatPeso(data.outputTax)}</td>
          </tr>

          {/* Purchases */}
          <tr><td colSpan={2} className="pt-4 text-xs font-semibold uppercase tracking-wide text-neutral-500">Purchases for the month</td></tr>
          {[
            ["18A. Purchase of capital goods (net)", data.capitalGoodsPurchases],
            ["18B. Purchase of capital goods (input tax)", data.capitalGoodsInputTax],
            ["19A. Other purchases (net)", data.otherPurchases],
            ["19B. Other purchases (input tax)", data.otherInputTax],
          ].map(([label, amt], i) => (
            <tr key={label as string} className={zebra(i)}>
              <td className="py-1 pl-4 pr-2">{label}</td>
              <td className={num}>{formatPeso(amt as number)}</td>
            </tr>
          ))}
          <tr className="font-semibold">
            <td className="border-t border-neutral-300 py-1 pr-2">Total current input tax</td>
            <td className={`border-t border-neutral-300 ${num}`}>{formatPeso(data.totalCurrentInputTax)}</td>
          </tr>
          <tr>
            <td className="py-1 pl-4 pr-2">17A. Input tax carried over from previous period</td>
            <td className={num}>{formatPeso(carryover)}</td>
          </tr>
          <tr className="font-semibold">
            <td className="py-1 pr-2">17F. Total allowable input tax</td>
            <td className={num}>{formatPeso(totalAllowableInputTax)}</td>
          </tr>

          {/* Result */}
          <tr className="text-base font-bold">
            <td className="border-t-2 border-neutral-800 py-2 pr-2">
              {vatPayable > 0 ? "VAT Payable" : "Excess Input Tax (carry to next period)"}
            </td>
            <td className="border-t-2 border-neutral-800 py-2 pr-2 text-right font-mono">
              {formatPeso(vatPayable > 0 ? vatPayable : excessInputTax)}
            </td>
          </tr>
        </tbody>
      </table>

      <ReportFooter />
    </main>
  );
}
