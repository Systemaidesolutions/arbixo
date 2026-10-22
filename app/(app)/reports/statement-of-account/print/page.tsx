import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePostingCompany } from "@/lib/currentUser";
import { getStatementOfAccount } from "@/lib/reports";
import { partyName, partyAddress } from "@/lib/slsp";
import { resolveBranchScope } from "@/lib/branchScope";
import { formatPeso, formatDate } from "@/lib/format";
import { PrintControls } from "@/components/PrintControls";

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

  const companyName = company.registeredName || company.tradeName;
  const companyAddr = [company.businessAddress, company.barangay, company.district, company.city, company.province, company.zipCode]
    .filter(Boolean)
    .join(", ");
  const statementDate = formatDate(new Date(`${dateTo}T00:00:00`));
  const custName = partyName(customer);
  const custAddr = partyAddress(customer);
  const supportLine = [company.telNo, company.email].filter(Boolean).join("  ·  ");

  const th = "border border-neutral-400 bg-sky-100 px-2 py-1.5 text-left font-semibold";
  const thNum = "border border-neutral-400 bg-sky-100 px-2 py-1.5 text-right font-semibold";
  const td = "border border-neutral-300 px-2 py-1 align-top";
  const tdNum = `${td} text-right font-mono whitespace-nowrap`;

  return (
    <main
      className="mx-auto max-w-[8.5in] bg-white p-8 text-neutral-900 print:p-0"
      style={{ fontFamily: '"Times New Roman", Times, serif' }}
    >
      <style>{`@media print { @page { size: A4; margin: 0.4in } html, body { height: auto !important; overflow: visible !important; } }`}</style>
      <PrintControls auto={false} />

      <div className="flex items-start justify-between border-b-2 border-neutral-800 pb-3">
        <div>
          <div className="text-base font-bold uppercase">{companyName}</div>
          {companyAddr && <div className="mt-0.5 text-xs text-neutral-700">{companyAddr}</div>}
          {company.telNo && <div className="mt-0.5 text-xs text-neutral-700">Tel: {company.telNo}</div>}
        </div>
        <div className="text-right text-2xl font-bold uppercase leading-tight tracking-wide">
          Statement
          <br />
          of Accounts
        </div>
      </div>

      <div className="mt-3 flex justify-end gap-8 text-xs">
        <div>
          <span className="font-semibold">Statement Date:</span> {statementDate}
        </div>
        <div>
          <span className="font-semibold">Customer Account ID:</span> {customer.code}
        </div>
      </div>

      <div className="mt-4 w-72 border border-neutral-400 p-2 text-xs">
        <div className="font-semibold text-neutral-500">To:</div>
        <div className="mt-1 font-semibold">{custName}</div>
        {custAddr && <div className="text-neutral-600">{custAddr}</div>}
      </div>

      <table className="mt-4 w-full border-collapse text-xs">
        <thead>
          <tr>
            <th className={th}>Date</th>
            <th className={th}>Reference</th>
            <th className={th}>Description</th>
            <th className={thNum}>Amount</th>
            <th className={thNum}>Balance</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className={`${td} italic text-neutral-600`} colSpan={4}>
              Balance forwarded
            </td>
            <td className={tdNum}>{formatPeso(balanceForward)}</td>
          </tr>
          {rows.map((r) => (
            <tr key={r.id}>
              <td className={`${td} whitespace-nowrap`}>{formatDate(r.postingDate)}</td>
              <td className={`${td} font-mono`}>{r.reference}</td>
              <td className={td}>{r.description}</td>
              <td className={tdNum}>{formatPeso(r.amount)}</td>
              <td className={tdNum}>{formatPeso(r.balance)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-emerald-100 font-bold">
            <td className="border-y-2 border-neutral-600 px-2 py-1.5" colSpan={4}>
              TOTAL AMOUNT DUE FOR PAYMENT
            </td>
            <td className="border-y-2 border-neutral-600 px-2 py-1.5 text-right font-mono">{formatPeso(total)}</td>
          </tr>
        </tfoot>
      </table>

      <div className="mt-6 flex items-start justify-between text-[10px]">
        <div>
          <div className="font-semibold uppercase tracking-wide">Client Support:</div>
          {supportLine && <div className="mt-0.5">{supportLine}</div>}
          {company.authorizedRep && <div className="mt-6 font-semibold">{company.authorizedRep}</div>}
          {company.authorizedRepPosition && <div className="text-neutral-600">{company.authorizedRepPosition}</div>}
        </div>
        <div className="max-w-[55%] text-right text-neutral-600">
          Please check this statement carefully and report any discrepancy to us.
        </div>
      </div>

      <div className="mt-10 border-t-2 border-dashed border-neutral-400" />

      <div className="mt-3 flex items-end justify-between text-xs">
        <div>
          <div className="font-semibold">{custName}</div>
          <div className="mt-1">TOTAL AMOUNT OF STATEMENT AS OF {statementDate}</div>
        </div>
        <div className="rounded border border-neutral-400 bg-sky-100 px-3 py-1.5 font-mono font-bold">
          {formatPeso(total)}
        </div>
      </div>

      <div className="mt-10 flex items-end gap-2 text-xs">
        <span className="font-semibold">RECEIVED BY:</span>
        <span className="flex-1 border-b border-neutral-400">&nbsp;</span>
        <span className="font-semibold">Date:</span>
        <span className="w-32 border-b border-neutral-400">&nbsp;</span>
      </div>
      <div className="mt-1 text-center text-[9px] text-neutral-500">Signature over printed name</div>
    </main>
  );
}
