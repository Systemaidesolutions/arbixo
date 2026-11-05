"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

export type PortalReimb = {
  id: string;
  date: string;
  category: string;
  description: string;
  amount: number;
  status: string;
  note: string | null;
  attachments: { id: string; fileName: string; contentType: string }[];
};

const CATEGORIES = ["Transportation", "Meals", "Supplies", "Communication", "Accommodation", "Medical", "Others"];
const MAX_FILES = 3;
const MAX_BYTES = 1_000_000;
const MAX_SIDE = 1600;

const card = "rounded-xl bg-white p-5 shadow-sm";
const field = "mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-base text-neutral-900";
const label = "block text-sm font-medium text-neutral-700";
const primary = "w-full rounded-lg bg-[#0B2A5E] px-4 py-3 text-base font-medium text-white hover:bg-[#123A73] disabled:opacity-50";

const STATUS: Record<string, [string, string]> = {
  PENDING: ["Pending approval", "bg-amber-100 text-amber-800"],
  APPROVED: ["Approved", "bg-green-100 text-green-800"],
  PAID: ["Paid", "bg-blue-100 text-blue-800"],
  REJECTED: ["Rejected", "bg-red-100 text-red-800"],
  CANCELLED: ["Cancelled", "bg-neutral-200 text-neutral-600"],
};

const peso = (n: number) => `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmt = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-PH", { timeZone: "UTC", month: "short", day: "numeric", year: "numeric" });

const approxBytes = (dataUrl: string) => Math.floor(((dataUrl.length - dataUrl.indexOf(",") - 1) * 3) / 4);

function readAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

/** Shrinks a photo to at most 1600px on the long side, as JPEG, so uploads stay small. */
async function shrinkImage(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("decode"));
      i.src = url;
    });
    const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    let q = 0.8;
    let out = canvas.toDataURL("image/jpeg", q);
    while (approxBytes(out) > MAX_BYTES && q > 0.4) {
      q -= 0.15;
      out = canvas.toDataURL("image/jpeg", q);
    }
    return out;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function ReimbursementSection({ items, ready, today }: { items: PortalReimb[]; ready: boolean; today: string }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({ expenseDate: today, category: "", amount: "", description: "" });
  const [files, setFiles] = useState<{ fileName: string; dataUrl: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function addFiles(list: FileList | null) {
    if (!list) return;
    setMsg(null);
    const next = [...files];
    for (const f of Array.from(list)) {
      if (next.length >= MAX_FILES) {
        setMsg({ ok: false, text: `You can attach up to ${MAX_FILES} files.` });
        break;
      }
      try {
        if (f.type === "application/pdf") {
          if (f.size > MAX_BYTES) {
            setMsg({ ok: false, text: `${f.name} is over 1 MB. Take a photo of the receipt instead.` });
            continue;
          }
          next.push({ fileName: f.name, dataUrl: await readAsDataUrl(f) });
        } else if (f.type.startsWith("image/") || /\.(heic|heif)$/i.test(f.name)) {
          const dataUrl = await shrinkImage(f);
          if (approxBytes(dataUrl) > MAX_BYTES) {
            setMsg({ ok: false, text: `${f.name} is too large even after shrinking.` });
            continue;
          }
          next.push({ fileName: f.name.replace(/\.[^.]+$/, "") + ".jpg", dataUrl });
        } else {
          setMsg({ ok: false, text: `${f.name}: attach a photo (JPG, PNG) or PDF.` });
        }
      } catch {
        setMsg({ ok: false, text: `${f.name} couldn't be read. Try taking the photo again, or use JPG.` });
      }
    }
    setFiles(next);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function post(url: string, body: object) {
    setBusy(true);
    setMsg(null);
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
    setBusy(false);
    const data = res ? await res.json().catch(() => ({})) : {};
    if (data.signin) {
      router.refresh();
      return false;
    }
    if (!res?.ok) {
      setMsg({ ok: false, text: data.error ?? (res?.status === 413 ? "The attachments are too large." : "Couldn't reach the server. Check your connection and try again.") });
      return false;
    }
    return true;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (files.length === 0) return setMsg({ ok: false, text: "Attach at least one photo of the receipt." });
    if (await post("/api/leave-portal/reimbursements", { ...form, attachments: files })) {
      setMsg({ ok: true, text: "Reimbursement filed. It's now waiting for approval." });
      setForm({ expenseDate: today, category: "", amount: "", description: "" });
      setFiles([]);
      router.refresh();
    }
  }

  async function withdraw(id: string) {
    if (!confirm("Withdraw this reimbursement?")) return;
    if (await post("/api/leave-portal/reimbursements/cancel", { id })) {
      setMsg({ ok: true, text: "Reimbursement withdrawn." });
      router.refresh();
    }
  }

  return (
    <>
      {msg && <p className={`mb-4 rounded-lg px-4 py-3 text-sm ${msg.ok ? "bg-green-50 text-green-800" : "bg-red-50 text-red-700"}`}>{msg.text}</p>}

      <section className={card}>
        <h2 className="text-sm font-semibold text-neutral-800">File a reimbursement</h2>
        {!ready ? (
          <p className="mt-2 text-sm text-neutral-500">Your payroll details aren&apos;t set up yet. Ask your HR or payroll staff.</p>
        ) : (
          <form onSubmit={submit} className="mt-3 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <label className={label}>
                Date of expense
                <input type="date" required max={today} value={form.expenseDate} onChange={(e) => setForm({ ...form, expenseDate: e.target.value })} className={field} />
              </label>
              <label className={label}>
                Amount (₱)
                <input
                  type="number"
                  inputMode="decimal"
                  min="0.01"
                  step="0.01"
                  required
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  className={field}
                />
              </label>
            </div>
            <label className={label}>
              Category
              <select required value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className={field}>
                <option value="">Choose…</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </label>
            <label className={label}>
              Details
              <textarea
                required
                rows={3}
                maxLength={1000}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="What was it for? e.g. Taxi to client meeting at Makati"
                className={field}
              />
            </label>
            <div>
              <span className={label}>Receipt</span>
              <div className="mt-1 flex flex-wrap gap-2">
                {files.map((f, i) => (
                  <div key={i} className="relative">
                    {f.dataUrl.startsWith("data:image/") ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={f.dataUrl} alt={f.fileName} className="h-20 w-20 rounded-lg border border-neutral-200 object-cover" />
                    ) : (
                      <div className="flex h-20 w-20 items-center justify-center rounded-lg border border-neutral-200 bg-neutral-50 p-1 text-center text-[10px] text-neutral-600">
                        PDF<br />{f.fileName.slice(0, 18)}
                      </div>
                    )}
                    <button
                      type="button"
                      aria-label={`Remove ${f.fileName}`}
                      onClick={() => setFiles(files.filter((_, j) => j !== i))}
                      className="absolute -right-2 -top-2 h-6 w-6 rounded-full bg-red-600 text-xs font-bold text-white shadow"
                    >
                      ×
                    </button>
                  </div>
                ))}
                {files.length < MAX_FILES && (
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="flex h-20 w-20 flex-col items-center justify-center rounded-lg border-2 border-dashed border-neutral-300 text-xs text-neutral-500 hover:bg-neutral-50"
                  >
                    <span className="text-xl leading-none">+</span>
                    Add photo
                  </button>
                )}
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*,application/pdf"
                multiple
                className="hidden"
                onChange={(e) => addFiles(e.target.files)}
              />
              <p className="mt-1 text-[11px] text-neutral-400">Take a photo or choose from your gallery. Up to {MAX_FILES} files.</p>
            </div>
            <button type="submit" disabled={busy} className={primary}>
              {busy ? "Filing…" : "File reimbursement"}
            </button>
          </form>
        )}
      </section>

      <section className={`${card} mt-4`}>
        <h2 className="text-sm font-semibold text-neutral-800">My reimbursements</h2>
        {items.length === 0 ? (
          <p className="mt-2 text-sm text-neutral-500">No reimbursements filed yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-neutral-100">
            {items.map((r) => {
              const [text, cls] = STATUS[r.status] ?? [r.status, ""];
              return (
                <li key={r.id} className="py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-neutral-800">
                        {peso(r.amount)} · {r.category}
                      </div>
                      <div className="text-sm text-neutral-600">{fmt(r.date)}</div>
                      <div className="break-words text-xs text-neutral-500">{r.description}</div>
                      {r.note && <div className="text-xs text-neutral-500">Note: {r.note}</div>}
                      <div className="mt-1 flex flex-wrap gap-2">
                        {r.attachments.map((a) => (
                          <a key={a.id} href={`/api/leave-portal/attachments/${a.id}`} target="_blank" rel="noreferrer" className="text-xs text-blue-700 underline">
                            {a.contentType === "application/pdf" ? "PDF receipt" : "Receipt photo"}
                          </a>
                        ))}
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${cls}`}>{text}</span>
                      {r.status === "PENDING" && (
                        <button onClick={() => withdraw(r.id)} disabled={busy} className="text-xs text-red-600 hover:underline disabled:opacity-50">
                          Withdraw
                        </button>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}
