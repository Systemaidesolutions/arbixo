"use client";

import { useEffect, useState } from "react";

type CheckoutData = {
  price: { name: string; amount: number; currency: string } | null;
  gcash: { name: string; number: string; qrImage: string | null };
  subscriptionEndsAt: string | null;
};

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

export function RenewClient({ onSubmitted }: { onSubmitted?: () => void }) {
  const [data, setData] = useState<CheckoutData | null>(null);
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
        setData(j as CheckoutData);
        setMonth(defaultMonth((j as CheckoutData).subscriptionEndsAt));
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
  const price = data.price;
  const field = "mt-1 w-full rounded border border-neutral-300 px-2 py-1.5 text-sm";
  const label = "block text-xs text-neutral-500";

  return (
    <section className="rounded-lg border border-neutral-200 p-4">
      <h2 className="text-sm font-medium text-neutral-800">Renew subscription</h2>
      {!price ? (
        <p className="mt-2 text-sm text-amber-600">No subscription price is set yet. Contact your administrator.</p>
      ) : (
        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-3">
            <div className="text-sm">
              {price.name} — <span className="font-mono">{price.currency} {price.amount.toFixed(2)}</span> for the month below.
            </div>
            <label className={label}>
              Month to pay for
              <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className={field} />
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
              disabled={busy}
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
