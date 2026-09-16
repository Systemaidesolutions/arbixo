"use client";

import { useEffect, useState } from "react";
import { PrintControls } from "@/components/PrintControls";

type FieldPos = { top: number; left: number };
type Layout = {
  width: number;
  height: number;
  date: FieldPos;
  payee: FieldPos;
  amountFigures: FieldPos;
  amountWords: FieldPos;
  memo: FieldPos;
};

const DEFAULT_LAYOUT: Layout = {
  width: 8.5,
  height: 3.5,
  date: { top: 0.5, left: 7.9 }, // left is measured from the right edge
  payee: { top: 1.35, left: 0.6 },
  amountFigures: { top: 1.35, left: 8.1 }, // left is measured from the right edge
  amountWords: { top: 1.75, left: 0.6 },
  memo: { top: 2.9, left: 0.6 },
};

const STORAGE_KEY = "arbixo-check-print-layout";

function loadLayout(): Layout {
  if (typeof window === "undefined") return DEFAULT_LAYOUT;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_LAYOUT;
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_LAYOUT, ...parsed };
  } catch {
    return DEFAULT_LAYOUT;
  }
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex items-center gap-1 text-xs text-neutral-600">
      {label}
      <input
        type="number"
        step={0.05}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-16 rounded border border-neutral-300 px-1 py-0.5 text-xs"
      />
      <span className="text-neutral-400">in</span>
    </label>
  );
}

export function CheckPrintClient({
  dateStr,
  payeeName,
  amountFormatted,
  amountWords,
  memo,
}: {
  dateStr: string;
  payeeName: string;
  amountFormatted: string;
  amountWords: string;
  memo: string;
}) {
  const [layout, setLayout] = useState<Layout>(DEFAULT_LAYOUT);
  const [adjusting, setAdjusting] = useState(false);
  const [showGrid, setShowGrid] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setLayout(loadLayout());
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
  }, [layout, ready]);

  function set<K extends keyof Layout>(key: K, value: Layout[K]) {
    setLayout((prev) => ({ ...prev, [key]: value }));
  }
  function setField(key: "date" | "payee" | "amountFigures" | "amountWords" | "memo", axis: "top" | "left", value: number) {
    setLayout((prev) => ({ ...prev, [key]: { ...prev[key], [axis]: value } }));
  }
  function reset() {
    setLayout(DEFAULT_LAYOUT);
  }

  // Grid lines every quarter inch, labeled every whole inch — meant to be
  // printed on a blank sheet and held up to the light against an actual
  // (voided) check to read off exactly how far each field needs to move.
  const gridLines = [];
  for (let x = 0; x <= layout.width; x += 0.25) {
    gridLines.push(
      <div
        key={`v${x}`}
        className="absolute top-0 bottom-0 border-l"
        style={{ left: `${x}in`, borderColor: Number.isInteger(x) ? "#93c5fd" : "#dbeafe" }}
      />
    );
  }
  for (let y = 0; y <= layout.height; y += 0.25) {
    gridLines.push(
      <div
        key={`h${y}`}
        className="absolute left-0 right-0 border-t"
        style={{ top: `${y}in`, borderColor: Number.isInteger(y) ? "#93c5fd" : "#dbeafe" }}
      />
    );
  }
  const labels = [];
  for (let x = 0; x <= layout.width; x += 1) {
    labels.push(
      <div key={`lx${x}`} className="absolute text-[9px] text-blue-400" style={{ left: `${x}in`, top: 2 }}>
        {x}
      </div>
    );
  }
  for (let y = 0; y <= layout.height; y += 1) {
    labels.push(
      <div key={`ly${y}`} className="absolute text-[9px] text-blue-400" style={{ top: `${y}in`, left: 2 }}>
        {y}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[900px] bg-white p-6 text-neutral-900 print:p-0">
      <style>{`@media print { @page { size: ${layout.width}in ${layout.height}in; margin: 0 } }`}</style>
      <PrintControls auto={false} />

      <div className="mb-4 flex flex-wrap items-center gap-3 print:hidden">
        <button
          onClick={() => setAdjusting((v) => !v)}
          className="rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50"
        >
          {adjusting ? "Hide alignment tools" : "Adjust alignment"}
        </button>
        {adjusting && (
          <>
            <label className="flex items-center gap-1 text-xs text-neutral-600">
              <input type="checkbox" checked={showGrid} onChange={(e) => setShowGrid(e.target.checked)} />
              Show ruler grid
            </label>
            <button onClick={reset} className="text-xs text-red-600 hover:underline">
              Reset to defaults
            </button>
          </>
        )}
      </div>

      {adjusting && (
        <div className="mb-4 flex flex-wrap gap-x-6 gap-y-2 rounded-lg border border-neutral-200 bg-neutral-50 p-3 print:hidden">
          <div className="flex items-center gap-3">
            <span className="w-24 shrink-0 text-xs font-medium text-neutral-700">Check size</span>
            <NumberField label="W" value={layout.width} onChange={(v) => set("width", v)} />
            <NumberField label="H" value={layout.height} onChange={(v) => set("height", v)} />
          </div>
          <div className="flex items-center gap-3">
            <span className="w-24 shrink-0 text-xs font-medium text-neutral-700">Date</span>
            <NumberField label="Top" value={layout.date.top} onChange={(v) => setField("date", "top", v)} />
            <NumberField label="From right" value={layout.date.left} onChange={(v) => setField("date", "left", v)} />
          </div>
          <div className="flex items-center gap-3">
            <span className="w-24 shrink-0 text-xs font-medium text-neutral-700">Payee</span>
            <NumberField label="Top" value={layout.payee.top} onChange={(v) => setField("payee", "top", v)} />
            <NumberField label="From left" value={layout.payee.left} onChange={(v) => setField("payee", "left", v)} />
          </div>
          <div className="flex items-center gap-3">
            <span className="w-24 shrink-0 text-xs font-medium text-neutral-700">Amount (figures)</span>
            <NumberField label="Top" value={layout.amountFigures.top} onChange={(v) => setField("amountFigures", "top", v)} />
            <NumberField label="From right" value={layout.amountFigures.left} onChange={(v) => setField("amountFigures", "left", v)} />
          </div>
          <div className="flex items-center gap-3">
            <span className="w-24 shrink-0 text-xs font-medium text-neutral-700">Amount (words)</span>
            <NumberField label="Top" value={layout.amountWords.top} onChange={(v) => setField("amountWords", "top", v)} />
            <NumberField label="From left" value={layout.amountWords.left} onChange={(v) => setField("amountWords", "left", v)} />
          </div>
          <div className="flex items-center gap-3">
            <span className="w-24 shrink-0 text-xs font-medium text-neutral-700">Memo</span>
            <NumberField label="Top" value={layout.memo.top} onChange={(v) => setField("memo", "top", v)} />
            <NumberField label="From left" value={layout.memo.left} onChange={(v) => setField("memo", "left", v)} />
          </div>
          <p className="w-full text-xs text-neutral-500">
            Print a blank sheet with "Show ruler grid" on, hold it up to the light against a voided check from this
            stock, and read off how far each field needs to move — changes here are saved on this device and apply
            to every check you print afterward.
          </p>
        </div>
      )}

      <div
        className="relative border border-dashed border-neutral-300 text-[13px] leading-tight print:border-0"
        style={{ width: `${layout.width}in`, height: `${layout.height}in`, maxWidth: "100%" }}
      >
        {showGrid && (
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            {gridLines}
            {labels}
          </div>
        )}

        {/* Date — top-right, where the date field sits on most PH business checks. */}
        <div className="absolute font-mono text-sm" style={{ top: `${layout.date.top}in`, right: `${layout.date.left}in` }}>
          {dateStr}
        </div>

        {/* Payee — "Pay to the order of" line. */}
        <div className="absolute text-base font-medium" style={{ top: `${layout.payee.top}in`, left: `${layout.payee.left}in` }}>
          {payeeName}
        </div>

        {/* Amount in figures — the boxed ₱ amount, upper right. */}
        <div
          className="absolute text-right font-mono text-base font-semibold"
          style={{ top: `${layout.amountFigures.top}in`, right: `${layout.amountFigures.left}in` }}
        >
          {amountFormatted}
        </div>

        {/* Amount in words — the "Pesos" line. */}
        <div className="absolute text-sm" style={{ top: `${layout.amountWords.top}in`, left: `${layout.amountWords.left}in` }}>
          {amountWords} Only {"*".repeat(20)}
        </div>

        {/* Memo. */}
        {memo && (
          <div className="absolute text-[11px]" style={{ top: `${layout.memo.top}in`, left: `${layout.memo.left}in` }}>
            {memo}
          </div>
        )}
      </div>
    </div>
  );
}
