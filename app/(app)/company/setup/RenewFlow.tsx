"use client";

import { useState } from "react";

type Checkout = {
  price: { name: string; amount: number; currency: string } | null;
  gcash: { name: string; number: string; qrImage: string | null };
  subscriptionEndsAt: string | null;
};
type Applied = { code: string; discountAmount: number; finalAmount: number } | null;

export function RenewFlow() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [checkout, setCheckout] = useState<Checkout | null>(null);
  const [loading, setLoading] = useState(false);

  const [voucher, setVoucher] = useState("");
  const [applied, setApplied] = useState<Applied>(null);
  const [voucherMsg, setVoucherMsg] = useState<string | null>(null);
  const [gcashRef, setGcashRef] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [doneRef, setDoneRef] = useState<string | null>(null);

  async function start() {
    setOpen(true);
    setStep(1);
    setApplied(null);
    setVoucher("");
    setVoucherMsg(null);
    setGcashRef("");
    setError(null);
    setLoading(true);
    const res = await fetch("/api/subscription/checkout");
    const data = await res.json().catch(() => ({}));
    setCheckout(res.ok ? data : { price: null, gcash: { name: "", number: "", qrImage: null }, subscriptionEndsAt: null });
    setLoading(false);
  }

  const price = checkout?.price ?? null;
  const cur = price?.currency ?? "PHP";
  const fmt = (n: number) => `${cur} ${n.toFixed(2)}`;
  const finalAmount = applied ? applied.finalAmount : price?.amount ?? 0;

  async function applyVoucher() {
    if (!voucher.trim()) return;
    setVoucherMsg(null);
    const res = await fetch("/api/subscription/voucher/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: voucher.trim() }),
    });
    const data = await res.json().catch(() => ({}));
    if (data?.valid) {
      setApplied({ code: data.code, discountAmount: data.discountAmount, finalAmount: data.finalAmount });
      setVoucherMsg(`Applied — ${fmt(data.discountAmount)} off.`);
    } else {
      setApplied(null);
      setVoucherMsg(data?.error ?? "That voucher isn't valid.");
    }
  }

  async function submitPayment() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/subscription/pay", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ voucherCode: applied?.code ?? "", gcashRef }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data?.error ?? "Could not submit payment.");
      return;
    }
    setDoneRef(gcashRef || null);
    setStep(3);
  }

  const field = "mt-1 w-full rounded border border-neutral-300 px-2 py-1.5 text-sm";

  return (
    <section className="mt-8">
      <button onClick={start} className="rounded bg-brand-navy px-4 py-2 text-sm text-white hover:bg-brand-navyLight">
        Renew subscription
      </button>

      {open && (
        <div className="mt-4 rounded-lg border border-neutral-200 p-5">
          {loading || !checkout ? (
            <p className="text-sm text-neutral-400">Loading…</p>
          ) : !price ? (
            <p className="text-sm text-neutral-500">No subscription price is set yet. Please contact your administrator.</p>
          ) : step === 1 ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-neutral-900">Step 1 — Price &amp; voucher</h3>
                <button onClick={() => setOpen(false)} className="text-xs text-neutral-400 hover:text-neutral-700">Cancel</button>
              </div>
              <div className="rounded-lg bg-neutral-50 p-4 text-sm">
                <div className="flex justify-between"><span className="text-neutral-500">Current price ({price.name})</span><span className="font-mono">{fmt(price.amount)}</span></div>
                {applied && (
                  <div className="mt-1 flex justify-between text-green-700"><span>Voucher {applied.code}</span><span className="font-mono">− {fmt(applied.discountAmount)}</span></div>
                )}
                <div className="mt-2 flex justify-between border-t border-neutral-200 pt-2 font-medium"><span>Amount due</span><span className="font-mono">{fmt(finalAmount)}</span></div>
              </div>

              <div>
                <label className="text-xs text-neutral-500">Voucher code (optional)</label>
                <div className="mt-1 flex gap-2">
                  <input value={voucher} onChange={(e) => { setVoucher(e.target.value.toUpperCase()); setApplied(null); setVoucherMsg(null); }} placeholder="Enter code" className="flex-1 rounded border border-neutral-300 px-2 py-1.5 font-mono text-sm uppercase" />
                  <button onClick={applyVoucher} disabled={!voucher.trim()} className="rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50 disabled:opacity-50">Apply</button>
                </div>
                {voucherMsg && <p className={`mt-1 text-xs ${applied ? "text-green-600" : "text-red-600"}`}>{voucherMsg}</p>}
              </div>

              <button onClick={() => setStep(2)} className="rounded bg-brand-navy px-4 py-2 text-sm text-white hover:bg-brand-navyLight">
                Continue to payment
              </button>
            </div>
          ) : step === 2 ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-neutral-900">Step 2 — Pay {fmt(finalAmount)} via GCash</h3>
                <button onClick={() => setStep(1)} className="text-xs text-neutral-400 hover:text-neutral-700">Back</button>
              </div>

              {checkout.gcash.qrImage || checkout.gcash.number ? (
                <div className="flex flex-col items-center gap-3 rounded-lg bg-neutral-50 p-4">
                  {checkout.gcash.qrImage && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={checkout.gcash.qrImage} alt="GCash QR" className="h-52 w-52 rounded border border-neutral-200 bg-white object-contain" />
                  )}
                  <div className="text-center text-sm">
                    <div className="font-medium text-neutral-800">{checkout.gcash.name || "GCash"}</div>
                    {checkout.gcash.number && <div className="font-mono text-neutral-600">{checkout.gcash.number}</div>}
                  </div>
                  <div className="flex gap-2">
                    <a href="gcash://" className="rounded bg-[#0074E0] px-3 py-1.5 text-xs font-medium text-white hover:brightness-110">
                      Open GCash app
                    </a>
                    {checkout.gcash.number && (
                      <button
                        type="button"
                        onClick={() => navigator.clipboard?.writeText(checkout.gcash.number)}
                        className="rounded border border-neutral-300 px-3 py-1.5 text-xs text-neutral-700 hover:bg-neutral-50"
                      >
                        Copy number
                      </button>
                    )}
                  </div>
                  <p className="text-center text-xs text-neutral-500">
                    Scan the QR{checkout.gcash.number ? " or send to the number above" : ""} and pay{" "}
                    <span className="font-medium">{fmt(finalAmount)}</span>, then enter the GCash reference number below.
                  </p>
                </div>
              ) : (
                <p className="text-sm text-amber-700">No GCash account is configured yet — contact your administrator.</p>
              )}

              <div>
                <label className="text-xs text-neutral-500">GCash reference no. (leave blank if you don&apos;t have it yet)</label>
                <input value={gcashRef} onChange={(e) => setGcashRef(e.target.value)} placeholder="e.g. 1234567890123" className={`${field} font-mono`} />
              </div>

              {error && <p className="text-sm text-red-600">{error}</p>}
              <button onClick={submitPayment} disabled={busy} className="rounded bg-brand-green px-4 py-2 text-sm text-white hover:brightness-110 disabled:opacity-50">
                {busy ? "Submitting…" : "I've paid — submit for verification"}
              </button>
            </div>
          ) : (
            <div className="space-y-3 text-center">
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-green-100 text-green-700">✓</div>
              <h3 className="text-sm font-medium text-neutral-900">Payment submitted</h3>
              <p className="text-sm text-neutral-500">
                Your payment of {fmt(finalAmount)} is recorded and pending administrator verification. Your
                subscription extends once it&apos;s verified.
                {doneRef ? <> Reference: <span className="font-mono">{doneRef}</span>.</> : null}
              </p>
              <button onClick={() => setOpen(false)} className="rounded border border-neutral-300 px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-50">Close</button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
