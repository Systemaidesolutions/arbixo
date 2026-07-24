"use client";

import { useEffect, useMemo, useState } from "react";
import { formatPeso } from "@/lib/format";
import { downloadXlsx } from "@/lib/exportXlsx";
import { BranchFilter, type Branch } from "@/components/BranchFilter";

type Line = {
  id: string;
  postingDate: string;
  documentNo: string;
  accountCode: string;
  accountTitle: string;
  particulars: string | null;
  counterparty: string | null;
  debit: number;
  credit: number;
};
type Data = { label: string; lines: Line[]; totalDebit: number; totalCredit: number };

function monthDefaults() {
  const now = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return {
    from: `${now.getFullYear()}-${p(now.getMonth() + 1)}-01`,
    to: now.toISOString().slice(0, 10),
  };
}

export function JournalBookClient({
  book,
  title,
  registeredName,
  partyLabel,
  locations = [],
}: {
  book: string;
  title: string;
  registeredName: string;
  partyLabel: string;
  locations?: Branch[];
}) {
  const def = useMemo(monthDefaults, []);
  const [from, setFrom] = useState(def.from);
  const [to, setTo] = useState(def.to);
  const [locationId, setLocationId] = useState("");
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    const params = new URLSearchParams({ book, from, to });
    if (locationId) params.set("locationId", locationId);
    fetch(`/api/books/journal?${params}`)
      .then((r) => r.json())
      .then((j) => active && setData(j))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [book, from, to, locationId]);

  function exportCsv() {
    if (!data) return;
    const out: (string | number)[][] = [
      ["Date", "Doc No.", partyLabel, "Account code", "Account", "Debit", "Credit"],
    ];
    for (const l of data.lines) {
      out.push([l.postingDate.slice(0, 10), l.documentNo, l.counterparty ?? "", l.accountCode, l.accountTitle, l.debit.toFixed(2), l.credit.toFixed(2)]);
    }
    out.push(["", "", "", "", "TOTAL", data.totalDebit.toFixed(2), data.totalCredit.toFixed(2)]);
    downloadXlsx(`${book}_${from}_to_${to}`, book, out);
  }

  const field = "rounded border border-neutral-300 px-2 py-1.5 text-sm";

  function printReport() {
    const params = new URLSearchParams({ book, from, to, _embed: "1" });
    if (locationId) params.set("locationId", locationId);
    window.open(`/books/journal/print?${params}`, "_blank");
  }

  return (
    <main className="mx-auto max-w-6xl p-4 sm:p-8">
      <div className="flex items-start justify-between gap-3">
        <h1 className="text-xl font-medium text-neutral-900">{title}</h1>
        <div className="flex shrink-0 gap-2 print:hidden">
          <button onClick={printReport} disabled={!data} className="rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50 disabled:opacity-40">Print</button>
          <button onClick={exportCsv} disabled={!data} className="rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50 disabled:opacity-40">Export to Excel</button>
        </div>
      </div>
      <p className="mt-1 text-sm text-neutral-500">{registeredName}</p>

      <div className="mt-4 flex flex-wrap items-end gap-3 rounded-lg border border-neutral-200 p-4 print:hidden">
        <BranchFilter locations={locations} value={locationId} onChange={setLocationId} fieldClass={field} />

        <label className="text-xs text-neutral-500">
          From
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={`mt-1 block ${field}`} />
        </label>
        <label className="text-xs text-neutral-500">
          To
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={`mt-1 block ${field}`} />
        </label>
      </div>

      <p className="mt-3 text-xs text-neutral-400">Covering {from} to {to}.</p>

      {loading || !data ? (
        <p className="mt-6 text-sm text-neutral-400">Loading…</p>
      ) : data.lines.length === 0 ? (
        <p className="mt-6 text-sm text-neutral-400">No entries in this period.</p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-lg border border-neutral-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Doc No.</th>
                <th className="px-3 py-2">{partyLabel}</th>
                <th className="px-3 py-2">Account</th>
                <th className="px-3 py-2 text-right">Debit</th>
                <th className="px-3 py-2 text-right">Credit</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                // Group by document: all lines of one document share a shaded
                // background, adjacent documents alternate, and the date / doc
                // no. / party show only on the document's first line (blank on
                // the rest, so one transaction reads as one block).
                let docIdx = -1;
                return data.lines.map((l, i) => {
                  const firstOfDoc = i === 0 || l.documentNo !== data.lines[i - 1].documentNo;
                  if (firstOfDoc) docIdx++;
                  return (
                    <tr
                      key={l.id}
                      className={`${docIdx % 2 === 1 ? "bg-neutral-50" : "bg-white"} ${
                        firstOfDoc && i > 0 ? "border-t border-neutral-300" : ""
                      }`}
                    >
                      <td className="px-3 py-1.5 text-xs">{firstOfDoc ? l.postingDate.slice(0, 10) : ""}</td>
                      <td className="px-3 py-1.5 font-mono text-xs">{firstOfDoc ? l.documentNo : ""}</td>
                      <td className="px-3 py-1.5 text-xs text-neutral-600">{firstOfDoc ? l.counterparty ?? "—" : ""}</td>
                      <td className="px-3 py-1.5 text-xs">
                        <span className="font-mono text-neutral-400">{l.accountCode}</span> {l.accountTitle}
                      </td>
                      <td className="px-3 py-1.5 text-right font-mono">{l.debit ? formatPeso(l.debit) : ""}</td>
                      <td className="px-3 py-1.5 text-right font-mono">{l.credit ? formatPeso(l.credit) : ""}</td>
                    </tr>
                  );
                });
              })()}
            </tbody>
            <tfoot>
              <tr className="bg-neutral-50 font-medium">
                <td className="px-3 py-2" colSpan={4}>TOTAL</td>
                <td className="px-3 py-2 text-right font-mono">{formatPeso(data.totalDebit)}</td>
                <td className="px-3 py-2 text-right font-mono">{formatPeso(data.totalCredit)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </main>
  );
}
