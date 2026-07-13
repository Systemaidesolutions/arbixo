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

const B = "border border-black";
const GREY = "bg-[#d9d9d9]";
const pad2 = (n: number) => String(n).padStart(2, "0");

// A row of fixed character cells (for TIN / dates / ZIP).
function Cells({ value = "", count, w = "w-[14px]", cellGrey = false }: { value?: string; count: number; w?: string; cellGrey?: boolean }) {
  const chars = value.split("");
  return (
    <div className="flex">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={`h-[15px] ${w} border border-black text-center text-[9px] leading-[15px] ${cellGrey ? GREY : ""}`}>
          {chars[i] ?? ""}
        </div>
      ))}
    </div>
  );
}

// TIN in 3-3-3-5 groups with grey dash separators (last group is the branch code).
function Tin({ value }: { value: string }) {
  const d = (value || "").replace(/\D/g, "");
  const dash = <div className={`flex h-[15px] w-[9px] items-center justify-center border border-black text-[9px] ${GREY}`}>-</div>;
  return (
    <div className="flex items-center">
      <Cells value={d.slice(0, 3)} count={3} />
      {dash}
      <Cells value={d.slice(3, 6)} count={3} />
      {dash}
      <Cells value={d.slice(6, 9)} count={3} />
      {dash}
      <Cells value={d.slice(9, 14)} count={5} cellGrey />
    </div>
  );
}

// A date as MM DD YYYY character cells.
function DateCells({ d }: { d: Date | null }) {
  const mm = d ? pad2(d.getMonth() + 1) : "";
  const dd = d ? pad2(d.getDate()) : "";
  const yy = d ? String(d.getFullYear()) : "";
  return (
    <div className="flex items-center gap-[2px]">
      <Cells value={mm} count={2} />
      <Cells value={dd} count={2} />
      <Cells value={yy} count={4} />
    </div>
  );
}

// Approximated Code128-style barcode (the blank form's is a static graphic).
function Barcode() {
  const widths = [2, 1, 3, 1, 2, 2, 1, 1, 3, 2, 1, 2, 1, 3, 1, 1, 2, 3, 1, 2, 2, 1, 3, 1, 1, 2, 1, 3, 2, 1, 1, 2, 3, 1, 2, 1, 2, 1, 3, 1, 2, 2, 1, 1, 3, 1, 2, 1];
  let x = 0;
  return (
    <svg viewBox="0 0 130 44" className="h-[44px] w-[130px]">
      {widths.map((w, i) => {
        const rect = i % 2 === 0 ? <rect key={i} x={x} y={0} width={w} height={44} fill="black" /> : null;
        x += w;
        return rect;
      })}
    </svg>
  );
}

const HEADS = ["Income Payments Subject to Expanded Withholding Tax", "ATC", "1st Month of the Quarter", "2nd Month of the Quarter", "3rd Month of the Quarter", "Total", "Tax Withheld for the Quarter"];

// BIR Form No. 2307 (January 2018 ENCS) — Certificate of Creditable Tax
// Withheld at Source. Laid out to match the official form; prints on Legal.
export function Form2307({ data, autoPrint = true }: { data: Form2307Data; autoPrint?: boolean }) {
  const { payee, payor, rows } = data;
  const d = new Date(data.postingDate);
  const q = Math.floor(d.getMonth() / 3);
  const monthCol = d.getMonth() % 3;
  const periodFrom = new Date(d.getFullYear(), q * 3, 1);
  const periodTo = new Date(d.getFullYear(), q * 3 + 3, 0);
  const totalIncome = rows.reduce((s, r) => s + r.income, 0);
  const totalTax = rows.reduce((s, r) => s + r.tax, 0);
  const amt = (n: number) => (n ? formatPeso(n) : "");

  // Part III detail rows (income sits in the quarter's month column), padded.
  const ewtRows = [...rows];
  while (ewtRows.length < 6) ewtRows.push({ atc: "", description: "", income: 0, tax: 0 });

  const cellTd = "border border-black px-1 py-[3px] align-top";
  const numTd = "border border-black px-1 py-[3px] text-right font-mono align-top";

  return (
    <div className="mx-auto w-[8in] bg-white text-[9px] leading-tight text-black print:w-full">
      <style>{`@media print { @page { size: 8.5in 14in; margin: 0.3in; } * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; } }`}</style>
      {autoPrint && <PrintControls auto={false} />}

      <div className={B}>
        {/* Top strip: For BIR Use Only + government heading */}
        <div className="flex border-b border-black">
          <div className="w-[150px] border-r border-black">
            <div className={`flex ${GREY}`}>
              <div className="w-[52px] border-r border-black px-1 py-[2px] text-[8px]">For BIR<br />Use Only</div>
              <div className="flex-1 px-1 py-[2px] text-[8px]">BCS/<br />Item:</div>
            </div>
          </div>
          <div className="flex flex-1 items-center justify-center gap-2 py-1">
            <svg viewBox="0 0 40 40" className="h-9 w-9">
              <circle cx="20" cy="20" r="19" fill="none" stroke="black" strokeWidth="1" />
              <circle cx="20" cy="20" r="14" fill="none" stroke="black" strokeWidth="0.7" />
              <polygon points="20,9 22.4,16.4 30,16.4 23.8,21 26.2,28.4 20,24 13.8,28.4 16.2,21 10,16.4 17.6,16.4" fill="black" />
            </svg>
            <div className="text-center leading-tight">
              <div className="text-[11px] font-bold">Republic of the Philippines</div>
              <div className="text-[11px]">Department of Finance</div>
              <div className="text-[11px] font-semibold">Bureau of Internal Revenue</div>
            </div>
          </div>
        </div>

        {/* Form no. | title | barcode */}
        <div className="flex border-b border-black">
          <div className="w-[150px] border-r border-black px-2 py-1 text-center leading-tight">
            <div className="text-[9px]">BIR Form No.</div>
            <div className="text-[26px] font-bold leading-none">2307</div>
            <div className="text-[9px]">January 2018 (ENCS)</div>
          </div>
          <div className="flex flex-1 items-center justify-center px-2 text-center">
            <div className="text-[20px] font-bold leading-tight">Certificate of Creditable Tax<br />Withheld at Source</div>
          </div>
          <div className="flex w-[150px] flex-col items-center justify-center border-l border-black py-1">
            <Barcode />
            <div className="mt-[2px] text-[8px]">2307 01/18ENCS</div>
          </div>
        </div>

        {/* Instruction */}
        <div className={`border-b border-black px-1 py-[2px] text-[9px] ${GREY}`}>
          Fill in all applicable spaces. Mark all appropriate boxes with an &quot;X&quot;.
        </div>

        {/* 1 — For the Period */}
        <div className="flex items-center border-b border-black px-1 py-[3px]">
          <span className="mr-2 font-bold">1</span>
          <span className="mr-3">For the Period</span>
          <span className="mr-1">From</span>
          <DateCells d={periodFrom} />
          <span className="mx-1 italic text-neutral-600">(MM/DD/YYYY)</span>
          <span className="ml-2 mr-1">To</span>
          <DateCells d={periodTo} />
          <span className="ml-1 italic text-neutral-600">(MM/DD/YYYY)</span>
        </div>

        {/* Part I — Payee */}
        <div className={`border-b border-black py-[2px] text-center font-bold ${GREY}`}>Part I – Payee Information</div>
        <div className="flex items-center border-b border-black px-1 py-[3px]">
          <span className="mr-2 font-bold">2</span>
          <span className="mr-2">Taxpayer Identification Number (TIN)</span>
          <Tin value={payee.tin} />
        </div>
        <div className="border-b border-black px-1 py-[3px]">
          <span className="font-bold">3</span> <span className="italic">Payee&apos;s Name (Last Name, First Name, Middle Name for Individual OR Registered Name for Non-Individual)</span>
          <div className="mt-[3px] min-h-[16px] font-semibold uppercase">{payee.name}</div>
        </div>
        <div className="flex border-b border-black">
          <div className="flex-1 border-r border-black px-1 py-[3px]">
            <span className="font-bold">4</span> Registered Address
            <div className="mt-[3px] min-h-[16px] uppercase">{payee.address}</div>
          </div>
          <div className="w-[150px] px-1 py-[3px]">
            <div><span className="font-bold">4A</span> ZIP Code</div>
            <div className="mt-[3px]"><Cells value={payee.zip ?? ""} count={4} /></div>
          </div>
        </div>
        <div className="border-b border-black px-1 py-[3px]">
          <span className="font-bold">5</span> <span className="italic">Foreign Address, if applicable</span>
          <div className="mt-[3px] min-h-[16px]">&nbsp;</div>
        </div>

        {/* Part II — Payor */}
        <div className={`border-b border-black py-[2px] text-center font-bold ${GREY}`}>Part II – Payor Information</div>
        <div className="flex items-center border-b border-black px-1 py-[3px]">
          <span className="mr-2 font-bold">6</span>
          <span className="mr-2">Taxpayer Identification Number (TIN)</span>
          <Tin value={payor.tin} />
        </div>
        <div className="border-b border-black px-1 py-[3px]">
          <span className="font-bold">7</span> <span className="italic">Payor&apos;s Name (Last Name, First Name, Middle Name for Individual OR Registered Name for Non-Individual)</span>
          <div className="mt-[3px] min-h-[16px] font-semibold uppercase">{payor.name}</div>
        </div>
        <div className="flex border-b border-black">
          <div className="flex-1 border-r border-black px-1 py-[3px]">
            <span className="font-bold">8</span> Registered Address
            <div className="mt-[3px] min-h-[16px] uppercase">{payor.address}</div>
          </div>
          <div className="w-[150px] px-1 py-[3px]">
            <div><span className="font-bold">8A</span> ZIP Code</div>
            <div className="mt-[3px]"><Cells value={payor.zip ?? ""} count={4} /></div>
          </div>
        </div>

        {/* Part III */}
        <div className={`border-b border-black py-[2px] text-center font-bold ${GREY}`}>Part III – Details of Monthly Income Payments and Taxes Withheld</div>
        <table className="w-full border-collapse text-[8px]">
          <thead>
            <tr className={`text-center ${GREY}`}>
              <th rowSpan={2} className="border border-black px-1 py-1 align-middle">{HEADS[0]}</th>
              <th rowSpan={2} className="border border-black px-1 py-1 align-middle">ATC</th>
              <th colSpan={4} className="border border-black px-1 py-1">AMOUNT OF INCOME PAYMENTS</th>
              <th rowSpan={2} className="border border-black px-1 py-1 align-middle">Tax Withheld<br />for the Quarter</th>
            </tr>
            <tr className={`text-center ${GREY}`}>
              <th className="border border-black px-1 py-1">1st Month<br />of the Quarter</th>
              <th className="border border-black px-1 py-1">2nd Month<br />of the Quarter</th>
              <th className="border border-black px-1 py-1">3rd Month<br />of the Quarter</th>
              <th className="border border-black px-1 py-1">Total</th>
            </tr>
          </thead>
          <tbody>
            {ewtRows.map((r, i) => (
              <tr key={i}>
                <td className={cellTd}>{r.description}</td>
                <td className={`${cellTd} text-center font-mono`}>{r.atc}</td>
                {[0, 1, 2].map((c) => (
                  <td key={c} className={numTd}>{r.income && c === monthCol ? amt(r.income) : ""}</td>
                ))}
                <td className={numTd}>{amt(r.income)}</td>
                <td className={numTd}>{amt(r.tax)}</td>
              </tr>
            ))}
            <tr className={`font-bold ${GREY}`}>
              <td className="border border-black px-1 py-[3px]">Total</td>
              <td className="border border-black" />
              <td className="border border-black" />
              <td className="border border-black" />
              <td className="border border-black" />
              <td className={numTd}>{amt(totalIncome)}</td>
              <td className={numTd}>{amt(totalTax)}</td>
            </tr>
            <tr className={`font-bold ${GREY}`}>
              <td colSpan={7} className="border border-black px-1 py-[3px] text-center">Money Payments Subject to Withholding of Business Tax</td>
            </tr>
            {[0, 1, 2].map((i) => (
              <tr key={`b${i}`}>
                <td className={cellTd}>&nbsp;</td>
                <td className={`${cellTd} ${GREY}`} />
                <td className={`${cellTd} ${GREY}`} />
                <td className={`${cellTd} ${GREY}`} />
                <td className={`${cellTd} ${GREY}`} />
                <td className={`${cellTd} ${GREY}`} />
                <td className={cellTd} />
              </tr>
            ))}
            <tr className={`font-bold ${GREY}`}>
              <td className="border border-black px-1 py-[3px]">Total</td>
              <td className="border border-black" />
              <td className="border border-black" />
              <td className="border border-black" />
              <td className="border border-black" />
              <td className="border border-black" />
              <td className="border border-black" />
            </tr>
          </tbody>
        </table>

        {/* Declaration */}
        <div className={`border-t border-black px-2 py-1 text-[9px] ${GREY}`}>
          We declare under the penalties of perjury that this certificate has been made in good faith, verified by us, and to the
          best of our knowledge and belief, is true and correct, pursuant to the provisions of the National Internal Revenue
          Code, as amended, and the regulations issued under authority thereof. Further, we give our consent to the processing of
          our information as contemplated under the *Data Privacy Act of 2012 (R.A. No. 10173) for legitimate and lawful purposes.
        </div>

        {/* Payor signature */}
        <div className="border-t border-black px-2 pb-1 pt-8 text-center">
          <div className="mx-auto max-w-[420px] border-t border-black pt-[2px] font-semibold uppercase">{payor.name}</div>
          <div className="text-[8px]">Signature over Printed Name of Payor/Payor&apos;s Authorized Representative/Tax Agent</div>
          <div className="text-[8px] italic">(Indicate Title/Designation and TIN)</div>
        </div>
        <div className="flex border-t border-black text-[8px]">
          <div className={`flex-1 border-r border-black px-1 py-1 ${GREY}`}>Tax Agent Accreditation No./<br />Attorney&apos;s Roll No. (if applicable)</div>
          <div className="w-[220px] border-r border-black" />
          <div className={`px-1 py-1 ${GREY}`}>Date of Issue<br />(MM/DD/YYYY)</div>
          <div className="flex items-center px-1"><DateCells d={null} /></div>
          <div className={`px-1 py-1 ${GREY}`}>Date of Expiry<br />(MM/DD/YYYY)</div>
          <div className="flex items-center px-1"><DateCells d={null} /></div>
        </div>

        {/* Conforme / Payee signature */}
        <div className={`border-t border-black px-2 py-[2px] text-center font-bold ${GREY}`}>CONFORME:</div>
        <div className="border-t border-black px-2 pb-1 pt-8 text-center">
          <div className="mx-auto max-w-[420px] border-t border-black pt-[2px] font-semibold uppercase">{payee.name}</div>
          <div className="text-[8px]">Signature over Printed Name of Payee/Payee&apos;s Authorized Representative/Tax Agent</div>
          <div className="text-[8px] italic">(Indicate Title/Designation and TIN)</div>
        </div>
        <div className="flex border-t border-black text-[8px]">
          <div className={`flex-1 border-r border-black px-1 py-1 ${GREY}`}>Tax Agent Accreditation No./<br />Attorney&apos;s Roll No. (if applicable)</div>
          <div className="w-[220px] border-r border-black" />
          <div className={`px-1 py-1 ${GREY}`}>Date of Issue<br />(MM/DD/YYYY)</div>
          <div className="flex items-center px-1"><DateCells d={null} /></div>
          <div className={`px-1 py-1 ${GREY}`}>Date of Expiry<br />(MM/DD/YYYY)</div>
          <div className="flex items-center px-1"><DateCells d={null} /></div>
        </div>
      </div>

      <div className="mt-[2px] text-[8px]">*NOTE: The BIR Data Privacy is in the BIR website (www.bir.gov.ph)</div>
    </div>
  );
}
