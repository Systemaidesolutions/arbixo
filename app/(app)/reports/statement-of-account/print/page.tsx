import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePostingCompany } from "@/lib/currentUser";
import { getStatementOfAccount } from "@/lib/reports";
import { partyName, partyAddress } from "@/lib/slsp";
import { resolveBranchScope } from "@/lib/branchScope";
import { formatPeso, formatDate, formatDateRangeCoverage } from "@/lib/format";
import { PrintControls } from "@/components/PrintControls";
import { ReportHeader } from "@/components/ReportHeader";

export default async function StatementOfAccountPrintPage({
  searchParams,
}: {
  searchParams: { customerId?: string; dateFrom?: string; dateTo?: string; locationId?: string };
}) {
  const company = await requirePostingCompany();
  if (!company) notFound();

  const { customerId, dateFrom, dateTo } = searchParams;
  if (!customerId || !dateFrom || !dateTo) notFound();

  const customer = await prisma.customer.findUnique({ where: { id: customerId } });
  if (!customer || customer.companyId !== company.id) notFound();

  const branch = await resolveBranchScope(company.id, searchParams.locationId);
  const { balanceForward, rows, total } = await getStatementOfAccount(
    company.id,
    customerId,
    new Date(`${dateFrom}T00:00:00`),
    new Date(`${dateTo}T23:59:59.999`),
    branch
  );

  const coverage = formatDateRangeCoverage(dateFrom, dateTo);
  const th = "border border-neutral-400 px-2 py-1 text-center align-middle font-semibold";
  const td = "border border-neutral-300 px-2 py-1 align-top";
  const tdNum = `${td} text-right font-mono whitespace-nowrap`;

  const supportLine = [company.telNo, company.email].filter(Boolean).join(" · ");

  return (
    <main className="mx-auto max-w-[8.5in] bg-white p-6 text-neutral-900 print:p-0">
      <style>{`@media print { @page { size: A4; margin: 0.4in } html, body { height: auto !important; overflow: visible !important; } }`}</style>
      <PrintControls auto={false} />

      <ReportHeader company={company} title="Statement of Account" coverage={coverage} />

      <div className="mt-4 text-sm">
        <div className="font-semibold">{partyName(customer)}</div>
        {partyAddress(customer) && <div className="text-neutral-600">{partyAddress(customer)}</div>}
        {customer.tin && <div className="text-neutral-600">{customer.tin}</div>}
      </div>

      <table className="mt-4 w-full border-collapse text-xs">
        <thead>
          <tr>
            <th className={th}>Date</th>
            <th className={th}>Due Date</th>
            <th className={th}>Reference</th>
            <th className={th}>Description</th>
            <th className={th}>Amount</th>
            <th className={th}>Balance</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className={td} colSpan={4}>Balance Fwd</td>
            <td className={tdNum}></td>
            <td className={tdNum}>{formatPeso(balanceForward)}</td>
          </tr>
          {rows.map((r) => (
            <tr key={r.id}>
              <td className={`${td} whitespace-nowrap`}>{formatDate(r.postingDate)}</td>
              <td className={`${td} whitespace-nowrap`}>{r.dueDate ? formatDate(r.dueDate) : ""}</td>
              <td className={`${td} font-mono`}>{r.reference}</td>
              <td className={td}>{r.description}</td>
              <td className={tdNum}>{formatPeso(r.amount)}</td>
              <td className={tdNum}>{formatPeso(r.balance)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="font-bold">
            <td className={`${td} border-2`} colSpan={5}>TOTAL</td>
            <td className={`${tdNum} border-2`}>{formatPeso(total)}</td>
          </tr>
        </tfoot>
      </table>

      <div className="mt-10 border-t border-neutral-300 pt-3 text-center text-[10px] text-neutral-500">
        <div className="font-semibold uppercase tracking-wide">Client Support</div>
        {supportLine && <div className="mt-0.5">{supportLine}</div>}
        <div className="mt-1">
          Please check this statement carefully and report any discrepancy to us.
        </div>
      </div>
    </main>
  );
}
