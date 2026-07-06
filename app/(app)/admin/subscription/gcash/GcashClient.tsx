"use client";

import { useEffect, useState } from "react";

export function GcashClient() {
  const [gcashName, setGcashName] = useState("");
  const [gcashNumber, setGcashNumber] = useState("");
  const [qrImage, setQrImage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    fetch("/api/admin/subscription/gcash")
      .then((r) => r.json())
      .then((j) => {
        setGcashName(j.gcashName ?? "");
        setGcashNumber(j.gcashNumber ?? "");
        setQrImage(j.gcashQrImage ?? null);
      })
      .catch(() => {});
  }, []);

  function onPickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setMsg({ ok: false, text: "Please choose an image file." });
      return;
    }
    if (file.size > 1.5 * 1024 * 1024) {
      setMsg({ ok: false, text: "Image is too large — keep it under ~1.5 MB." });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setQrImage(reader.result as string);
    reader.readAsDataURL(file);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    const res = await fetch("/api/admin/subscription/gcash", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gcashName, gcashNumber, gcashQrImage: qrImage }),
    });
    setSaving(false);
    const data = await res.json().catch(() => ({}));
    setMsg(res.ok ? { ok: true, text: "GCash account saved." } : { ok: false, text: data?.error ?? "Could not save." });
  }

  const field = "mt-1 w-full rounded border border-neutral-300 px-2 py-1.5 text-sm";
  const label = "block text-xs text-neutral-500";

  return (
    <form onSubmit={save} className="mt-6 max-w-md space-y-4 rounded-lg border border-neutral-200 p-4">
      <label className={label}>
        Account name
        <input value={gcashName} onChange={(e) => setGcashName(e.target.value)} placeholder="Juan Dela Cruz" className={field} />
      </label>
      <label className={label}>
        GCash mobile number
        <input value={gcashNumber} onChange={(e) => setGcashNumber(e.target.value)} placeholder="09171234567" inputMode="numeric" className={`${field} font-mono`} />
      </label>

      <div className={label}>
        GCash QR code
        <p className="mt-0.5 font-normal text-neutral-400">
          Upload your GCash “receive money” QR (from the GCash app → Show QR). This is what subscribers
          scan — it&apos;s the only reliably scannable option. The amount is shown as text for them to enter.
        </p>
        <div className="mt-2 flex items-center gap-4">
          {qrImage ? (
            <div className="flex flex-col items-center gap-1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrImage} alt="GCash QR" className="h-40 w-40 rounded border border-neutral-200 object-contain" />
              <button type="button" onClick={() => setQrImage(null)} className="text-xs text-red-600 hover:underline">
                Remove
              </button>
            </div>
          ) : (
            <span className="text-sm text-neutral-400">No QR uploaded.</span>
          )}
          <input type="file" accept="image/*" onChange={onPickImage} className="text-sm" />
        </div>
      </div>

      {msg && <p className={`text-sm ${msg.ok ? "text-green-600" : "text-red-600"}`}>{msg.text}</p>}
      <button type="submit" disabled={saving} className="rounded bg-brand-navy px-4 py-2 text-sm text-white hover:bg-brand-navyLight disabled:opacity-50">
        {saving ? "Saving…" : "Save GCash account"}
      </button>
    </form>
  );
}
