import { notFound } from "next/navigation";
import { requirePostingCompany } from "@/lib/currentUser";
import { prisma } from "@/lib/prisma";
import { formatPeso } from "@/lib/format";
import { PrintControls } from "@/components/PrintControls";
import type { JournalType } from "@prisma/client";

// BIR Form 2307 — Certificate of Creditable Tax Withheld at Source.
// For income journals (Cash Receipt / Sales), the company is the PAYEE whose
// income had tax withheld, and the counterparty (customer) is the PAYOR /
// withholding agent — matching how SAWT reads this data.
const QUARTER_MONTHS = ["1st Month", "2nd Month", "3rd Month"];

export default async function Form2307Page({ params }: { params: { journalType: string; documentNo: string } }) {
  const company = await requirePostingCompany();
  if (!company) notFound();

  const journalType = params.journalType as JournalType;
  const documentNo = decodeURIComponent(params.documentNo);
  const entries = await prisma.ledgerEntry.findMany({
    where: { companyId: company.id, journalType, documentNo },
    include: { customer: true, vendor: true, employee: true, contact: true },
    orderBy: { lineNo: "asc" },
  });
  if (entries.length === 0) notFound();

  // Payor = the counterparty (withholding agent).
  const withParty = entries.find((e) => e.customer || e.vendor || e.employee || e.contact);
  const cp = withParty?.customer || withParty?.vendor || withParty?.contact;
  const payorName =
    cp?.registeredName || cp?.tradeName ||
    (withParty?.employee ? `${withParty.employee.firstName} ${withParty.employee.lastName}` : null) ||
    [cp?.lastName, cp?.firstName].filter(Boolean).join(", ") || "";
  const payorTin = withParty?.customer?.tin ?? withParty?.vendor?.tin ?? withParty?.contact?.tin ?? "";
  const payorAddress = cp?.address ?? "";

  // Payee = the company (income recipient).
  const payeeName = company.registeredName || company.tradeName;
  const payeeAddr = [company.businessAddress, company.barangay, company.city, company.province, company.zipCode]
    .filter(Boolean)
    .join(", ");

  const d = new Date(entries[0].postingDate);
  const month = d.getMonth();
  const quarter = Math.floor(month / 3) + 1;
  const monthCol = month % 3; // which of the quarter's three months
  const quarterEnd = new Date(d.getFullYear(), quarter * 3, 0);

  // One row per ATC, summing the income base (net) and the tax withheld.
  const rowsByAtc = new Map<string, { atc: string; description: string; income: number; tax: number }>();
  for (const e of entries) {
    const tax = Number(e.withholdingAmt ?? 0);
    if (tax <= 0) continue;
    const key = e.atcCode ?? "—";
    const existing = rowsByAtc.get(key);
    const income = Number(e.netAmount ?? 0);
    if (existing) {
      existing.income += income;
      existing.tax += tax;
    } else {
      rowsByAtc.set(key, { atc: e.atcCode ?? "", description: e.atcDescription ?? e.description ?? "", income, tax });
    }
  }
  const rows = [...rowsByAtc.values()];
  const totalIncome = rows.reduce((s, r) => s + r.income, 0);
  const totalTax = rows.reduce((s, r) => s + r.tax, 0);

  const b = "border border-neutral-800";
  const padRows = Math.max(0, 4 - rows.length);

  return (
    <div className="mx-auto max-w-[820px] bg-white p-6 text-neutral-900 print:p-0">
      <PrintControls />

      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="text-[10px] leading-tight">
          <div>BIR Form No.</div>
          <div className="text-lg font-bold">2307</div>
        </div>
        <div className="text-center">
          <div className="text-sm font-bold uppercase">Certificate of Creditable Tax</div>
          <div className="text-sm font-bold uppercase">Withheld at Source</div>
        </div>
        <div className="text-right text-[10px] leading-tight">
          <div className="font-semibold">For the Quarter</div>
          <div>{quarter}Q {d.getFullYear()}</div>
          <div>Ending {quarterEnd.toLocaleDateString()}</div>
        </div>
      </div>

      {rows.length === 0 && (
        <div className="mt-4 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          This transaction has no creditable withholding tax, so the certificate below has no detail lines.
        </div>
      )}

      {/* Part I — Payee */}
      <div className={`mt-4 ${b} text-xs`}>
        <div className="bg-neutral-100 px-2 py-1 font-semibold">Part I – Payee Information</div>
        <table className="w-full">
          <tbody>
            <tr>
              <td className="w-1/4 border-r border-t border-neutral-800 px-2 py-1"><span className="text-[10px] text-neutral-500">TIN</span><div>{company.tin || "—"}</div></td>
              <td className="border-t border-neutral-800 px-2 py-1"><span className="text-[10px] text-neutral-500">Payee&apos;s Name</span><div>{payeeName}</div></td>
            </tr>
            <tr>
              <td colSpan={2} className="border-t border-neutral-800 px-2 py-1"><span className="text-[10px] text-neutral-500">Registered Address</span><div>{payeeAddr || "—"}</div></td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Part II — Payor */}
      <div className={`mt-3 ${b} text-xs`}>
        <div className="bg-neutral-100 px-2 py-1 font-semibold">Part II – Payor Information (Withholding Agent)</div>
        <table className="w-full">
          <tbody>
            <tr>
              <td className="w-1/4 border-r border-t border-neutral-800 px-2 py-1"><span className="text-[10px] text-neutral-500">TIN</span><div>{payorTin || "—"}</div></td>
              <td className="border-t border-neutral-800 px-2 py-1"><span className="text-[10px] text-neutral-500">Payor&apos;s Name</span><div>{payorName || "—"}</div></td>
            </tr>
            <tr>
              <td colSpan={2} className="border-t border-neutral-800 px-2 py-1"><span className="text-[10px] text-neutral-500">Registered Address</span><div>{payorAddress || "—"}</div></td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Part III — Details */}
      <div className="mt-3 text-xs">
        <div className="text-[10px] font-semibold">
          Part III – Details of Monthly Income Payments and Tax Withheld for the Quarter
        </div>
        <table className={`mt-1 w-full ${b}`}>
          <thead>
            <tr className="bg-neutral-100 text-center">
              <th className="border-b border-r border-neutral-800 px-2 py-1 text-left">Income payments subject to EWT</th>
              <th className="border-b border-r border-neutral-800 px-1 py-1">ATC</th>
              {QUARTER_MONTHS.map((m) => (
                <th key={m} className="border-b border-r border-neutral-800 px-1 py-1">{m}</th>
              ))}
              <th className="border-b border-neutral-800 px-2 py-1">Tax Withheld</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td className="border-r border-t border-neutral-800 px-2 py-1">{r.description || "Income payment"}</td>
                <td className="border-r border-t border-neutral-800 px-1 py-1 text-center font-mono">{r.atc || "—"}</td>
                {[0, 1, 2].map((c) => (
                  <td key={c} className="border-r border-t border-neutral-800 px-1 py-1 text-right font-mono">
                    {c === monthCol && r.income ? formatPeso(r.income) : ""}
                  </td>
                ))}
                <td className="border-t border-neutral-800 px-2 py-1 text-right font-mono">{formatPeso(r.tax)}</td>
              </tr>
            ))}
            {Array.from({ length: padRows }).map((_, i) => (
              <tr key={`p${i}`}>
                <td className="border-r border-t border-neutral-800 px-2 py-3">&nbsp;</td>
                <td className="border-r border-t border-neutral-800" />
                <td className="border-r border-t border-neutral-800" />
                <td className="border-r border-t border-neutral-800" />
                <td className="border-r border-t border-neutral-800" />
                <td className="border-t border-neutral-800" />
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="font-semibold">
              <td className="border-r border-t border-neutral-800 px-2 py-1 text-right" colSpan={2}>Total</td>
              <td className="border-r border-t border-neutral-800 px-1 py-1 text-right font-mono" colSpan={3}>{formatPeso(totalIncome)}</td>
              <td className="border-t border-neutral-800 px-2 py-1 text-right font-mono">{formatPeso(totalTax)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Signatures */}
      <table className={`mt-4 w-full ${b} text-xs`}>
        <tbody>
          <tr className="align-top">
            <td className="w-1/2 border-r border-neutral-800 p-2">
              <div className="text-[10px] text-neutral-500">
                We declare, under the penalties of perjury, that this certificate has been made in good faith.
              </div>
              <div className="mt-8 text-center text-[11px] font-semibold">{payorName || "_______________________"}</div>
              <div className="text-center text-[10px] text-neutral-500">Payor / Authorized Agent — Signature over Printed Name</div>
            </td>
            <td className="w-1/2 p-2">
              <div className="text-[10px] text-neutral-500">
                Conforme: the information provided above is true and correct.
              </div>
              <div className="mt-8 text-center text-[11px] font-semibold">{payeeName}</div>
              <div className="text-center text-[10px] text-neutral-500">Payee / Authorized Agent — Signature over Printed Name</div>
            </td>
          </tr>
        </tbody>
      </table>

      <p className="mt-2 text-[9px] text-neutral-400">
        System-generated draft based on {documentNo}. Amounts reflect this transaction only, not the full quarter.
      </p>
    </div>
  );
}
