"use client";

import { useEffect, useState } from "react";
import { tierFor } from "@/lib/payroll/subscriptionTiers";

type Price = { name: string; amount: number; currency: string };
type CheckoutData = {
  price: Price | null;
  gcash: { name: string; number: string; qrImage: string | null };
  subscriptionEndsAt: string | null;
  payroll: {
    prices: (Price & { maxEmployees: number })[];
    paidMonths: Record<string, number>; // "YYYY-MM" → employee tier paid
    activeEmployees: number;
  };
};
export type RenewApp = "ACCOUNTING" | "PAYROLL";

// yyyy-mm for <input type="month">, defaulting to the calendar month
// containing subscriptionEndsAt (a month-aligned payment's periodEnd lands
// exactly on the 1st of the next uncovered month), or the current month if
// there's no subscription yet.
function defaultMonth(endsAt: string | null): string {
  const d = endsAt ? new Date(endsAt) : new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

const MAX_RECEIPT_BYTES = 2_000_000;

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function RenewClient({ onSubmitted, defaultApp = "ACCOUNTING" }: { onSubmitted?: () => void; defaultApp?: RenewApp }) {
  const [data, setData] = useState<CheckoutData | null>(null);
  const [app, setApp] = useState<RenewApp>(defaultApp);
  const [tier, setTier] = useState<number | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [month, setMonth] = useState("");
  const [voucher, setVoucher] = useState("");
  const [gcashRef, setGcashRef] = useState("");
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    fetch("/api/subscription/checkout")
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!r.ok) {
          setLoadError(j?.error ?? `Could not load renewal info (HTTP ${r.status}).`);
          return;
        }
        const d = j as CheckoutData;
        setData(d);
        setMonth(defaultMonth(d.subscriptionEndsAt));
        // Payroll: the smallest priced tier that fits today's active employees.
        const need = tierFor(Math.max(1, d.payroll.activeEmployees));
        const fit = d.payroll.prices.find((p) => p.maxEmployees >= need) ?? d.payroll.prices[d.payroll.prices.length - 1];
        setTier(fit?.maxEmployees ?? null);
      })
      .catch(() => setLoadError("Could not reach the server."));
  }, []);

  async function handleFile(file: File | null) {
    setReceiptFile(file);
    if (!file) {
      setReceiptPreview(null);
      return;
    }
    if (file.size > MAX_RECEIPT_BYTES) {
      setMsg({ ok: false, text: "Receipt image is too large (max ~2 MB)." });
      setReceiptFile(null);
      setReceiptPreview(null);
      return;
    }
    setReceiptPreview(await fileToDataUrl(file));
  }

  async function submit() {
    if (!month) {
      setMsg({ ok: false, text: "Pick a month to pay for." });
      return;
    }
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/subscription/pay", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        app,
        maxEmployees: app === "PAYROLL" ? tier : undefined,
        month,
        voucherCode: voucher.trim(),
        gcashRef: gcashRef.trim(),
        receiptImage: receiptPreview ?? "",
      }),
    });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setMsg({ ok: false, text: j?.error ?? "Could not submit the payment." });
      return;
    }
    setMsg({ ok: true, text: "Payment submitted — an administrator will verify it before the month is activated." });
    setVoucher("");
    setGcashRef("");
    setReceiptFile(null);
    setReceiptPreview(null);
    onSubmitted?.();
  }

  if (loadError) return <p className="text-sm text-red-600">{loadError}</p>;
  if (!data) return <p className="text-sm text-neutral-400">Loading…</p>;
  const payrollPrice = data.payroll.prices.find((p) => p.maxEmployees === tier) ?? null;
  const price = app === "PAYROLL" ? payrollPrice : data.price;
  const paidTier = data.payroll.paidMonths[month];
  const tooSmall = app === "PAYROLL" && tier != null && tier < data.payroll.activeEmployees;
  const field = "mt-1 w-full rounded border border-neutral-300 px-2 py-1.5 text-sm";
  const label = "block text-xs text-neutral-500";

  return (
    <section className="rounded-lg border border-neutral-200 p-4">
      <h2 className="text-sm font-medium text-neutral-800">Renew subscription</h2>
      <div className="mt-3 inline-flex rounded border border-neutral-300 p-0.5 text-sm">
        {([["ACCOUNTING", "ARbixo Accounting"], ["PAYROLL", "ARbixo Payroll"]] as const).map(([k, l]) => (
          <button
            key={k}
            type="button"
            onClick={() => { setApp(k); setMsg(null); }}
            className={`rounded px-3 py-1 ${app === k ? "bg-brand-navy text-white" : "text-neutral-600 hover:bg-neutral-100"}`}
          >
            {l}
          </button>
        ))}
      </div>
      {app === "PAYROLL" && (
        <p className="mt-2 text-xs text-neutral-500">
          Billed monthly by employee count. You have <b>{data.payroll.activeEmployees}</b> active payroll employee(s). Payroll runs can only be
          created, edited and posted for months you have paid, and only while your employees fit the tier.
        </p>
      )}
      {app === "PAYROLL" && data.payroll.prices.length === 0 ? (
        <p className="mt-2 text-sm text-amber-600">No ARbixo Payroll prices are set yet. Contact your administrator.</p>
      ) : !price && app === "ACCOUNTING" ? (
        <p className="mt-2 text-sm text-amber-600">No subscription price is set yet. Contact your administrator.</p>
      ) : (
        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-3">
            {app === "PAYROLL" && (
              <label className={label}>
                Employees
                <select value={tier ?? ""} onChange={(e) => setTier(Number(e.target.value))} className={field}>
                  {data.payroll.prices.map((p) => (
                    <option key={p.maxEmployees} value={p.maxEmployees}>
                      Up to {p.maxEmployees} employees — {p.currency} {p.amount.toFixed(2)} / month
                    </option>
                  ))}
                </select>
                {tooSmall && (
                  <span className="mt-1 block text-[11px] text-red-600">
                    This tier is smaller than your {data.payroll.activeEmployees} active employees; payroll runs would stay locked.
                  </span>
                )}
              </label>
            )}
            {price && (
              <div className="text-sm">
                {price.name} — <span className="font-mono">{price.currency} {price.amount.toFixed(2)}</span> for the month below.
              </div>
            )}
            <label className={label}>
              Month to pay for
              <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className={field} />
              {app === "PAYROLL" && paidTier ? (
                <span className="mt-1 block text-[11px] text-amber-700">
                  This month is already paid for up to {paidTier} employees. Pay again only to move to a bigger tier.
                </span>
              ) : null}
            </label>
            <label className={label}>
              Voucher code (optional)
              <input
                value={voucher}
                onChange={(e) => setVoucher(e.target.value.toUpperCase())}
                placeholder="Enter code"
                className={`${field} font-mono uppercase`}
              />
            </label>
            <label className={label}>
              GCash / bank reference no. (optional)
              <input value={gcashRef} onChange={(e) => setGcashRef(e.target.value)} placeholder="Transaction reference" className={`${field} font-mono`} />
            </label>
            <label className={label}>
              Receipt / proof of payment (optional)
              <input
                type="file"
                accept="image/*"
                onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
                className={`${field} file:mr-3 file:rounded file:border-0 file:bg-neutral-100 file:px-2 file:py-1 file:text-xs`}
              />
            </label>
            {receiptPreview && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={receiptPreview} alt="Receipt preview" className="h-32 w-auto rounded border border-neutral-200 object-contain" />
            )}
            <button
              onClick={submit}
              disabled={busy || !price}
              className="rounded bg-brand-navy px-4 py-2 text-sm text-white hover:bg-brand-navyLight disabled:opacity-50"
            >
              {busy ? "Submitting…" : "Submit payment"}
            </button>
            {msg && <p className={`text-xs ${msg.ok ? "text-green-600" : "text-red-600"}`}>{msg.text}</p>}
          </div>
          {(data.gcash.qrImage || data.gcash.number) && (
            <div className="flex flex-col items-center justify-center gap-2 rounded-lg bg-neutral-50 p-3 ring-1 ring-neutral-200">
              {data.gcash.qrImage && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={data.gcash.qrImage} alt="GCash QR" className="h-36 w-36 object-contain" />
              )}
              <div className="text-center text-xs">
                <div className="font-medium text-neutral-700">{data.gcash.name || "GCash"}</div>
                {data.gcash.number && <div className="font-mono text-neutral-500">{data.gcash.number}</div>}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
