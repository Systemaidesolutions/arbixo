"use client";

import { useEffect, useMemo, useState } from "react";
import { formatPeso } from "@/lib/format";
import { downloadXlsx } from "@/lib/exportXlsx";
import { BranchFilter, type Branch } from "@/components/BranchFilter";
import { tinWithDashes, mmddyyyy, digitsOnly } from "@/lib/reliefFormat";

type Row = Record<string, string | number> & {
  id: string; tin: string; name: string; address: string;
  reg: string; last: string; first: string; middle: string;
};
type Data = { rows: Row[]; totals: Record<string, number> };

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
// Blank (not "0") is how BIR's own RELIEF template shows a zero total.
const orBlank = (n: number) => (n === 0 ? "" : n.toFixed(2));
// Individual/sole-proprietor supplier or customer name as "Last, First Middle";
// blank for a corporate party (whose name is already in the Registered Name column).
const personName = (r: Row) =>
  r.last || r.first || r.middle ? `${r.last ?? ""}, ${r.first ?? ""} ${r.middle ?? ""}`.replace(/\s+/g, " ").trim() : "";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const SLP_COLS: { key: string; label: string }[] = [
  { key: "exempt", label: "Exempt" },
  { key: "zeroRated", label: "Zero-Rated" },
  { key: "services", label: "Services" },
  { key: "capitalGoods", label: "Capital Goods" },
  { key: "goods", label: "Goods" },
  { key: "taxable", label: "Taxable" },
  { key: "gross", label: "Gross Purchase" },
  { key: "inputTax", label: "Input Tax" },
];
const SLS_COLS: { key: string; label: string }[] = [
  { key: "exempt", label: "Exempt" },
  { key: "zeroRated", label: "Zero-Rated" },
  { key: "taxable", label: "Taxable" },
  { key: "gross", label: "Gross Sales" },
  { key: "outputTax", label: "Output Tax" },
];

function monthRange(y: number, m: number) {
  const last = new Date(y, m, 0).getDate();
  const p = (n: number) => String(n).padStart(2, "0");
  return { from: `${y}-${p(m)}-01`, to: `${y}-${p(m)}-${p(last)}` };
}
function quarterRange(y: number, q: number) {
  const sm = (q - 1) * 3 + 1;
  const em = sm + 2;
  const last = new Date(y, em, 0).getDate();
  const p = (n: number) => String(n).padStart(2, "0");
  return { from: `${y}-${p(sm)}-01`, to: `${y}-${p(em)}-${p(last)}` };
}

export function SlspClient({
  kind,
  tin,
  registeredName,
  tradeName,
  address,
  locations,
}: {
  kind: "slp" | "sls";
  tin: string;
  registeredName: string;
  tradeName: string;
  address: string;
  locations: Branch[];
}) {
  const now = new Date();
  const cols = kind === "slp" ? SLP_COLS : SLS_COLS;
  const title = kind === "slp" ? "Summary List of Purchases (SLP)" : "Summary List of Sales (SLS)";
  const partyLabel = kind === "slp" ? "Supplier" : "Customer";

  const [mode, setMode] = useState<"month" | "quarter" | "range">("quarter");
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [quarter, setQuarter] = useState(Math.floor(now.getMonth() / 3) + 1);
  const [from, setFrom] = useState(`${now.getFullYear()}-01-01`);
  const [to, setTo] = useState(now.toISOString().slice(0, 10));
  const [locationId, setLocationId] = useState("");
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(false);

  const range = useMemo(() => {
    if (mode === "month") return monthRange(year, month);
    if (mode === "quarter") return quarterRange(year, quarter);
    return { from, to };
  }, [mode, year, month, quarter, from, to]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetch(`/api/reports/bir/${kind}?from=${range.from}&to=${range.to}&locationId=${locationId}`)
      .then((r) => r.json())
      .then((j) => {
        if (active) setData(j);
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [kind, range.from, range.to, locationId]);

  // Matches BIR's own RELIEF SLP/SLS Excel template: a taxpayer header block,
  // numbered columns (per BIR's own column numbering), one row per party, a
  // Grand Total row, and an END OF REPORT footer.
  function exportCsv() {
    if (!data) return;
    const taxableMonth = mmddyyyy(new Date(`${range.to}T00:00:00`));

    const out: (string | number)[][] = [
      [kind === "slp" ? "PURCHASE TRANSACTION" : "SALES TRANSACTION"],
      ["RECONCILIATION OF LISTING FOR ENFORCEMENT"],
      [],
      [],
      [],
      [`TIN : ${digitsOnly(tin)}`],
      [`OWNER'S NAME: ${registeredName}`],
      [`OWNER'S TRADE NAME : ${tradeName}`],
      [`OWNER'S ADDRESS: ${address}`],
      [],
    ];

    if (kind === "slp") {
      out.push(
        ["TAXABLE", "TAXPAYER", "REGISTERED NAME", "NAME OF SUPPLIER", "SUPPLIER'S ADDRESS", "AMOUNT OF", "AMOUNT OF", "AMOUNT OF", "AMOUNT OF", "AMOUNT OF", "AMOUNT OF", "AMOUNT OF", "AMOUNT OF", "AMOUNT OF"],
        ["MONTH", "IDENTIFICATION", "", "(Last Name, First Name, Middle Name)", "", "GROSS PURCHASE", "EXEMPT PURCHASE", "ZERO-RATED PURCHASE", "TAXABLE PURCHASE", "PURCHASE OF SERVICES", "PURCHASE OF CAPITAL GOODS", "PURCHASE OF GOODS OTHER THAN CAPITAL GOODS", "INPUT TAX", "GROSS TAXABLE PURCHASE"],
        ["", "NUMBER", "", "", "", "", "", "", "", "", "", "", "", ""],
        ["(1)", "(2)", "(3)", "(4)", "(5)", "(6)", "(7)", "(8)", "(9)", "(10)", "(11)", "(12)", "(13)", "(14)"]
      );
      for (const r of data.rows) {
        out.push([
          taxableMonth, tinWithDashes(r.tin), r.reg, personName(r), r.address,
          Number(r.gross).toFixed(2), Number(r.exempt).toFixed(2), Number(r.zeroRated).toFixed(2), Number(r.taxable).toFixed(2),
          Number(r.services).toFixed(2), Number(r.capitalGoods).toFixed(2), Number(r.goods).toFixed(2), Number(r.inputTax).toFixed(2),
          round2(Number(r.taxable) + Number(r.inputTax)).toFixed(2),
        ]);
      }
      const t = data.totals;
      out.push([]);
      out.push([
        "Grand Total :", "", "", "", "",
        orBlank(Number(t.gross)), orBlank(Number(t.exempt)), orBlank(Number(t.zeroRated)), orBlank(Number(t.taxable)),
        orBlank(Number(t.services)), orBlank(Number(t.capitalGoods)), orBlank(Number(t.goods)), orBlank(Number(t.inputTax)),
        orBlank(round2(Number(t.taxable) + Number(t.inputTax))),
      ]);
    } else {
      out.push(
        ["TAXABLE", "TAXPAYER", "REGISTERED NAME", "NAME OF CUSTOMER", "CUSTOMER'S ADDRESS", "AMOUNT OF", "AMOUNT OF", "AMOUNT OF", "AMOUNT OF", "AMOUNT OF", "AMOUNT OF"],
        ["MONTH", "IDENTIFICATION", "", "(Last Name, First Name, Middle Name)", "", "GROSS SALES", "EXEMPT SALES", "ZERO RATED SALES", "TAXABLE SALES", "OUTPUT TAX", "GROSS TAXABLE SALES"],
        ["", "NUMBER", "", "", "", "", "", "", "", "", ""],
        ["(1)", "(2)", "(3)", "(4)", "(5)", "(6)", "(7)", "(8)", "(9)", "(10)", "(11)"]
      );
      for (const r of data.rows) {
        out.push([
          taxableMonth, tinWithDashes(r.tin), r.reg, personName(r), r.address,
          Number(r.gross).toFixed(2), Number(r.exempt).toFixed(2), Number(r.zeroRated).toFixed(2), Number(r.taxable).toFixed(2),
          Number(r.outputTax).toFixed(2), round2(Number(r.taxable) + Number(r.outputTax)).toFixed(2),
        ]);
      }
      const t = data.totals;
      out.push([]);
      out.push([
        "Grand Total :", "", "", "", "",
        orBlank(Number(t.gross)), orBlank(Number(t.exempt)), orBlank(Number(t.zeroRated)), orBlank(Number(t.taxable)),
        orBlank(Number(t.outputTax)), orBlank(round2(Number(t.taxable) + Number(t.outputTax))),
      ]);
    }

    out.push([]);
    out.push(["END OF REPORT"]);

    downloadXlsx(`${kind.toUpperCase()}_${range.from}_to_${range.to}`, kind.toUpperCase(), out);
  }

  const field = "rounded border border-neutral-300 px-2 py-1.5 text-sm";

  return (
    <main className="mx-auto max-w-6xl p-4 sm:p-8">
      <h1 className="text-xl font-medium text-neutral-900">{title}</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Per-{partyLabel.toLowerCase()} summary from posted entries, for RELIEF/BIR reporting. Verify
        before submitting.
      </p>

      <div className="mt-4 rounded-lg border border-neutral-200 p-4 text-sm text-neutral-600">
        <div>TIN: <span className="font-mono">{tin}</span></div>
        <div>Registered Name: {registeredName}</div>
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-3 rounded-lg border border-neutral-200 p-4 print:hidden">
        <label className="text-xs text-neutral-500">
          Period
          <select value={mode} onChange={(e) => setMode(e.target.value as typeof mode)} className={`mt-1 block ${field}`}>
            <option value="month">Monthly</option>
            <option value="quarter">Quarterly</option>
            <option value="range">Date range</option>
          </select>
        </label>

        {mode !== "range" && (
          <label className="text-xs text-neutral-500">
            Year
            <input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} className={`mt-1 block w-24 ${field}`} />
          </label>
        )}
        {mode === "month" && (
          <label className="text-xs text-neutral-500">
            Month
            <select value={month} onChange={(e) => setMonth(Number(e.target.value))} className={`mt-1 block ${field}`}>
              {MONTHS.map((m, i) => (
                <option key={m} value={i + 1}>{m}</option>
              ))}
            </select>
          </label>
        )}
        {mode === "quarter" && (
          <label className="text-xs text-neutral-500">
            Quarter
            <select value={quarter} onChange={(e) => setQuarter(Number(e.target.value))} className={`mt-1 block ${field}`}>
              {[1, 2, 3, 4].map((q) => (
                <option key={q} value={q}>Q{q}</option>
              ))}
            </select>
          </label>
        )}
        {mode === "range" && (
          <>
            <label className="text-xs text-neutral-500">
              From
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={`mt-1 block ${field}`} />
            </label>
            <label className="text-xs text-neutral-500">
              To
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={`mt-1 block ${field}`} />
            </label>
          </>
        )}

        <BranchFilter locations={locations} value={locationId} onChange={setLocationId} fieldClass={field} />

        <div className="ml-auto flex gap-2">
          <a
            href={`/api/reports/bir/${kind}/dat?from=${range.from}&to=${range.to}&locationId=${locationId}`}
            download
            className="rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50"
          >
            Export BIR .DAT
          </a>
          <button onClick={exportCsv} className="rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50">
            Export to Excel
          </button>
          <button onClick={() => window.print()} className="rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50">
            Print
          </button>
        </div>
      </div>

      <p className="mt-3 text-xs text-neutral-400">Covering {range.from} to {range.to}.</p>

      {loading || !data ? (
        <p className="mt-6 text-sm text-neutral-400">Loading…</p>
      ) : data.rows.length === 0 ? (
        <p className="mt-6 text-sm text-neutral-400">No {kind === "slp" ? "purchases" : "sales"} in this period.</p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-lg border border-neutral-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
                <th className="px-3 py-2">TIN</th>
                <th className="px-3 py-2">{partyLabel}</th>
                <th className="px-3 py-2">Address</th>
                {cols.map((c) => (
                  <th key={c.key} className="px-3 py-2 text-right">{c.label}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {data.rows.map((r) => (
                <tr key={r.id}>
                  <td className="px-3 py-1.5 font-mono text-xs">{r.tin || "—"}</td>
                  <td className="px-3 py-1.5">{r.name}</td>
                  <td className="max-w-[220px] truncate px-3 py-1.5 text-xs text-neutral-500" title={r.address}>{r.address}</td>
                  {cols.map((c) => (
                    <td key={c.key} className="px-3 py-1.5 text-right font-mono">{formatPeso(Number(r[c.key]))}</td>
                  ))}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-neutral-50 font-medium">
                <td className="px-3 py-2" colSpan={3}>TOTAL</td>
                {cols.map((c) => (
                  <td key={c.key} className="px-3 py-2 text-right font-mono">{formatPeso(Number(data.totals[c.key]))}</td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </main>
  );
}
