"use client";

import { formatPeso } from "@/lib/format";
import { PrintControls } from "@/components/PrintControls";

export type Row2307 = { atc: string; description: string; income: number; tax: number };
export type Form2307Data = {
  payee: { name: string; tin: string; address: string };
  payor: { name: string; tin: string; address: string };
  postingDate: string; // yyyy-mm-dd (or full ISO)
  documentNo: string;
  rows: Row2307[];
};

const QUARTER_MONTHS = ["1st Month", "2nd Month", "3rd Month"];

// BIR Form 2307 — Certificate of Creditable Tax Withheld at Source.
// Presentational only: the caller supplies payee/payor/rows, whether from a
// posted document or from an unsaved form (preview). Auto-prints on mount.
export function Form2307({ data, autoPrint = true }: { data: Form2307Data; autoPrint?: boolean }) {
  const { payee, payor, rows, documentNo } = data;

  const d = new Date(data.postingDate);
  const month = d.getMonth();
  const quarter = Math.floor(month / 3) + 1;
  const monthCol = month % 3;
  const quarterEnd = new Date(d.getFullYear(), quarter * 3, 0);

  const totalIncome = rows.reduce((s, r) => s + r.income, 0);
  const totalTax = rows.reduce((s, r) => s + r.tax, 0);

  const b = "border border-neutral-800";
  const padRows = Math.max(0, 4 - rows.length);

  return (
    <div className="mx-auto max-w-[820px] bg-white p-6 text-neutral-900 print:p-0">
      {autoPrint && <PrintControls />}

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
              <td className="w-1/4 border-r border-t border-neutral-800 px-2 py-1"><span className="text-[10px] text-neutral-500">TIN</span><div>{payee.tin || "—"}</div></td>
              <td className="border-t border-neutral-800 px-2 py-1"><span className="text-[10px] text-neutral-500">Payee&apos;s Name</span><div>{payee.name}</div></td>
            </tr>
            <tr>
              <td colSpan={2} className="border-t border-neutral-800 px-2 py-1"><span className="text-[10px] text-neutral-500">Registered Address</span><div>{payee.address || "—"}</div></td>
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
              <td className="w-1/4 border-r border-t border-neutral-800 px-2 py-1"><span className="text-[10px] text-neutral-500">TIN</span><div>{payor.tin || "—"}</div></td>
              <td className="border-t border-neutral-800 px-2 py-1"><span className="text-[10px] text-neutral-500">Payor&apos;s Name</span><div>{payor.name || "—"}</div></td>
            </tr>
            <tr>
              <td colSpan={2} className="border-t border-neutral-800 px-2 py-1"><span className="text-[10px] text-neutral-500">Registered Address</span><div>{payor.address || "—"}</div></td>
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
              <div className="mt-8 text-center text-[11px] font-semibold">{payor.name || "_______________________"}</div>
              <div className="text-center text-[10px] text-neutral-500">Payor / Authorized Agent — Signature over Printed Name</div>
            </td>
            <td className="w-1/2 p-2">
              <div className="text-[10px] text-neutral-500">Conforme: the information provided above is true and correct.</div>
              <div className="mt-8 text-center text-[11px] font-semibold">{payee.name}</div>
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
