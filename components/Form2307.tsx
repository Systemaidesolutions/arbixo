"use client";

import { formatPeso } from "@/lib/format";
import { PrintControls } from "@/components/PrintControls";

export type Row2307 = { atc: string; description: string; income: number; tax: number };
export type Party2307 = { name: string; tin: string; address: string; zip?: string };
export type Form2307Data = {
  payee: Party2307; // income recipient (supplier / vendor)
  payor: Party2307; // withholding agent (the company)
  postingDate: string; // yyyy-mm-dd — used to derive the quarter/period
  documentNo: string;
  rows: Row2307[];
};

const mmddyyyy = (d: Date) =>
  `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}/${d.getFullYear()}`;
const peso = (n: number) => (n ? formatPeso(n) : "");

// BIR Form No. 2307 (January 2018 ENCS) — Certificate of Creditable Tax
// Withheld at Source. Faithful to the official front-page layout. Presentational
// only; the caller supplies payee (supplier) and payor (company).
export function Form2307({ data, autoPrint = true }: { data: Form2307Data; autoPrint?: boolean }) {
  const { payee, payor, rows } = data;

  const d = new Date(data.postingDate);
  const month = d.getMonth();
  const quarter = Math.floor(month / 3);
  const monthCol = month % 3; // 0/1/2 within the quarter
  const periodFrom = new Date(d.getFullYear(), quarter * 3, 1);
  const periodTo = new Date(d.getFullYear(), quarter * 3 + 3, 0);

  const totalIncome = rows.reduce((s, r) => s + r.income, 0);
  const totalTax = rows.reduce((s, r) => s + r.tax, 0);
  const dataRows = Math.max(rows.length, 4);

  const bx = "border border-black";
  const num = "w-5 shrink-0 border-r border-black text-center font-semibold";

  // Part III row (EWT). Income sits in the quarter's month column.
  const detailRow = (r: Row2307 | null, key: string | number) => (
    <tr key={key}>
      <td className="border-r border-t border-black px-1 py-0.5">{r?.description ?? ""}</td>
      <td className="border-r border-t border-black px-1 py-0.5 text-center font-mono">{r?.atc ?? ""}</td>
      {[0, 1, 2].map((c) => (
        <td key={c} className="border-r border-t border-black px-1 py-0.5 text-right font-mono">
          {r && c === monthCol ? peso(r.income) : ""}
        </td>
      ))}
      <td className="border-r border-t border-black px-1 py-0.5 text-right font-mono">{r ? peso(r.income) : ""}</td>
      <td className="border-t border-black px-1 py-0.5 text-right font-mono">{r ? peso(r.tax) : ""}</td>
    </tr>
  );

  const blankRow = (key: string | number) => (
    <tr key={key}>
      <td className="border-r border-t border-black px-1 py-1.5">&nbsp;</td>
      <td className="border-r border-t border-black" />
      <td className="border-r border-t border-black" />
      <td className="border-r border-t border-black" />
      <td className="border-r border-t border-black" />
      <td className="border-r border-t border-black" />
      <td className="border-t border-black" />
    </tr>
  );

  const partHeader = (
    <>
      <tr className="bg-neutral-200 text-center align-middle">
        <th rowSpan={2} className="border-r border-b border-black px-1 py-0.5 text-left align-middle">
          Income Payments Subject to Expanded Withholding Tax
        </th>
        <th rowSpan={2} className="border-r border-b border-black px-1 py-0.5 align-middle">ATC</th>
        <th colSpan={4} className="border-r border-b border-black px-1 py-0.5">AMOUNT OF INCOME PAYMENTS</th>
        <th rowSpan={2} className="border-b border-black px-1 py-0.5 align-middle">Tax Withheld<br />for the Quarter</th>
      </tr>
      <tr className="bg-neutral-200 text-center">
        <th className="border-r border-b border-black px-1 py-0.5">1st Month<br />of the Quarter</th>
        <th className="border-r border-b border-black px-1 py-0.5">2nd Month<br />of the Quarter</th>
        <th className="border-r border-b border-black px-1 py-0.5">3rd Month<br />of the Quarter</th>
        <th className="border-r border-b border-black px-1 py-0.5">Total</th>
      </tr>
    </>
  );

  return (
    <div className="mx-auto max-w-[860px] bg-white p-4 text-[10px] leading-tight text-black print:p-0">
      {autoPrint && <PrintControls />}

      {/* Header */}
      <div className={`flex ${bx}`}>
        <div className="w-24 shrink-0 border-r border-black p-1 text-[8px] leading-tight">
          <div>BIR Form No.</div>
          <div className="text-lg font-bold leading-none">2307</div>
          <div>January 2018 (ENCS)</div>
        </div>
        <div className="flex-1 py-1 text-center">
          <div>Republic of the Philippines</div>
          <div>Department of Finance</div>
          <div>Bureau of Internal Revenue</div>
          <div className="mt-1 text-sm font-bold">Certificate of Creditable Tax Withheld at Source</div>
        </div>
        <div className="w-20 shrink-0 border-l border-black p-1 text-center text-[8px]">
          <div className="font-semibold">2307</div>
        </div>
      </div>

      <div className="border-x border-b border-black px-1 py-0.5 italic">
        Fill in all applicable spaces. Mark all appropriate boxes with an &quot;X&quot;.
      </div>

      {/* 1 — Period */}
      <div className="flex border-x border-b border-black">
        <div className={num}>1</div>
        <div className="flex flex-1 items-center gap-4 px-1 py-0.5">
          <span>For the Period</span>
          <span>From <b className="font-mono">{mmddyyyy(periodFrom)}</b></span>
          <span>To <b className="font-mono">{mmddyyyy(periodTo)}</b></span>
          <span className="text-[8px] text-neutral-500">(MM/DD/YYYY)</span>
        </div>
      </div>

      {/* Part I — Payee */}
      <div className="border-x border-b border-black bg-neutral-200 px-1 font-semibold">Part I – Payee Information</div>
      <div className="flex border-x border-b border-black">
        <div className={num}>2</div>
        <div className="flex-1 px-1 py-0.5">
          <div className="text-[8px] text-neutral-600">Taxpayer Identification Number (TIN)</div>
          <div className="font-mono">{payee.tin || "—"}</div>
        </div>
      </div>
      <div className="flex border-x border-b border-black">
        <div className={num}>3</div>
        <div className="flex-1 px-1 py-0.5">
          <div className="text-[8px] text-neutral-600">Payee&apos;s Name (Last Name, First Name, Middle Name for Individual OR Registered Name for Non-Individual)</div>
          <div className="font-semibold">{payee.name || "—"}</div>
        </div>
      </div>
      <div className="flex border-x border-b border-black">
        <div className={num}>4</div>
        <div className="flex-1 border-r border-black px-1 py-0.5">
          <div className="text-[8px] text-neutral-600">Registered Address</div>
          <div>{payee.address || "—"}</div>
        </div>
        <div className="w-40 shrink-0 px-1 py-0.5">
          <div className="text-[8px] text-neutral-600">4A ZIP Code</div>
          <div className="font-mono">{payee.zip || ""}</div>
        </div>
      </div>
      <div className="flex border-x border-b border-black">
        <div className={num}>5</div>
        <div className="flex-1 px-1 py-0.5">
          <div className="text-[8px] text-neutral-600">Foreign Address, if applicable</div>
          <div>&nbsp;</div>
        </div>
      </div>

      {/* Part II — Payor */}
      <div className="border-x border-b border-black bg-neutral-200 px-1 font-semibold">Part II – Payor Information</div>
      <div className="flex border-x border-b border-black">
        <div className={num}>6</div>
        <div className="flex-1 px-1 py-0.5">
          <div className="text-[8px] text-neutral-600">Taxpayer Identification Number (TIN)</div>
          <div className="font-mono">{payor.tin || "—"}</div>
        </div>
      </div>
      <div className="flex border-x border-b border-black">
        <div className={num}>7</div>
        <div className="flex-1 px-1 py-0.5">
          <div className="text-[8px] text-neutral-600">Payor&apos;s Name (Last Name, First Name, Middle Name for Individual OR Registered Name for Non-Individual)</div>
          <div className="font-semibold">{payor.name || "—"}</div>
        </div>
      </div>
      <div className="flex border-x border-b border-black">
        <div className={num}>8</div>
        <div className="flex-1 border-r border-black px-1 py-0.5">
          <div className="text-[8px] text-neutral-600">Registered Address</div>
          <div>{payor.address || "—"}</div>
        </div>
        <div className="w-40 shrink-0 px-1 py-0.5">
          <div className="text-[8px] text-neutral-600">8A ZIP Code</div>
          <div className="font-mono">{payor.zip || ""}</div>
        </div>
      </div>

      {/* Part III */}
      <div className="border-x border-b border-black bg-neutral-200 px-1 font-semibold">
        Part III – Details of Monthly Income Payments and Taxes Withheld
      </div>
      <table className="w-full border-x border-black text-[9px]">
        <thead>{partHeader}</thead>
        <tbody>
          {Array.from({ length: dataRows }).map((_, i) => (rows[i] ? detailRow(rows[i], i) : blankRow(i)))}
          <tr className="bg-neutral-100 font-semibold">
            <td className="border-r border-t border-black px-1 py-0.5 text-right" colSpan={5}>Total</td>
            <td className="border-r border-t border-black px-1 py-0.5 text-right font-mono">{peso(totalIncome)}</td>
            <td className="border-t border-black px-1 py-0.5 text-right font-mono">{peso(totalTax)}</td>
          </tr>
        </tbody>
      </table>

      {/* Section B — Money payments subject to business tax (left blank for EWT-only certs) */}
      <table className="w-full border-x border-b border-black text-[9px]">
        <tbody>
          <tr className="bg-neutral-200 font-semibold">
            <td colSpan={7} className="border-t border-black px-1 py-0.5">
              Money Payments Subject to Withholding of Business Tax (Government &amp; Private)
            </td>
          </tr>
          {blankRow("b0")}
          {blankRow("b1")}
          <tr className="bg-neutral-100 font-semibold">
            <td className="border-r border-t border-black px-1 py-0.5 text-right" colSpan={5}>Total</td>
            <td className="border-r border-t border-black px-1 py-0.5 text-right font-mono" />
            <td className="border-t border-black px-1 py-0.5 text-right font-mono" />
          </tr>
        </tbody>
      </table>

      {/* Declaration */}
      <div className="border-x border-b border-black px-2 py-1 text-[9px]">
        We declare under the penalties of perjury that this certificate has been made in good faith, verified by us, and to
        the best of our knowledge and belief, is true and correct, pursuant to the provisions of the National Internal
        Revenue Code, as amended, and the regulations issued under authority thereof. Further, we give our consent to the
        processing of our information as contemplated under the *Data Privacy Act of 2012 (R.A. No. 10173) for legitimate
        and lawful purposes.
      </div>

      {/* Payor signature */}
      <div className="border-x border-b border-black px-2 pb-1 pt-6 text-center">
        <div className="mx-auto max-w-[420px] border-t border-black pt-0.5 text-[9px] font-semibold">{payor.name || ""}</div>
        <div className="text-[8px]">Signature over Printed Name of Payor/Payor&apos;s Authorized Representative/Tax Agent</div>
        <div className="text-[8px] text-neutral-600">(Indicate Title/Designation and TIN)</div>
      </div>
      <div className="flex border-x border-b border-black text-[8px]">
        <div className="flex-1 border-r border-black px-1 py-1">Tax Agent Accreditation No./<br />Attorney&apos;s Roll No. (if applicable)</div>
        <div className="flex-1 border-r border-black px-1 py-1">Date of Issue (MM/DD/YYYY)</div>
        <div className="flex-1 px-1 py-1">Date of Expiry (MM/DD/YYYY)</div>
      </div>

      {/* Conforme / Payee signature */}
      <div className="border-x border-b border-black px-2 py-0.5 font-semibold">CONFORME:</div>
      <div className="border-x border-b border-black px-2 pb-1 pt-6 text-center">
        <div className="mx-auto max-w-[420px] border-t border-black pt-0.5 text-[9px] font-semibold">{payee.name || ""}</div>
        <div className="text-[8px]">Signature over Printed Name of Payee/Payee&apos;s Authorized Representative/Tax Agent</div>
        <div className="text-[8px] text-neutral-600">(Indicate Title/Designation and TIN)</div>
      </div>
      <div className="flex border-x border-b border-black text-[8px]">
        <div className="flex-1 border-r border-black px-1 py-1">Tax Agent Accreditation No./<br />Attorney&apos;s Roll No. (if applicable)</div>
        <div className="flex-1 border-r border-black px-1 py-1">Date of Issue (MM/DD/YYYY)</div>
        <div className="flex-1 px-1 py-1">Date of Expiry (MM/DD/YYYY)</div>
      </div>

      <div className="mt-1 text-[8px] text-neutral-500">
        *NOTE: The BIR Data Privacy Policy is in the BIR website (www.bir.gov.ph). System-generated from {data.documentNo};
        amounts reflect this transaction only, not the full quarter.
      </div>
    </div>
  );
}
