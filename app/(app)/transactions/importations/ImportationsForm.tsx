"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { formatPeso } from "@/lib/format";
import { usePageStack } from "@/components/PageStack";

type Importation = {
  id: string;
  assessReleaseDate: string;
  sellerName: string;
  importDate: string;
  countryOrigin: string;
  dutiableValue: number;
  charges: number;
  isVatExempt: boolean;
  vatAmount: number;
  orNo: string;
  paymentDate: string;
};

type FormState = {
  importDate: string;
  assessReleaseDate: string;
  sellerName: string;
  countryOrigin: string;
  dutiableValue: string;
  charges: string;
  isVatExempt: boolean;
  orNo: string;
  paymentDate: string;
};

function emptyForm(): FormState {
  const today = new Date().toISOString().slice(0, 10);
  return {
    importDate: today,
    assessReleaseDate: today,
    sellerName: "",
    countryOrigin: "",
    dutiableValue: "",
    charges: "",
    isVatExempt: false,
    orNo: "",
    paymentDate: today,
  };
}

function fmtDate(iso: string) {
  return iso ? new Date(iso).toISOString().slice(0, 10) : "—";
}

export function ImportationsForm({ companyId, canPost }: { companyId: string; canPost: boolean }) {
  const router = useRouter();
  const ps = usePageStack();
  const [items, setItems] = useState<Importation[]>([]);

  // Open Cash Disbursement showing only its page (chrome-less): as a new
  // stacked panel on the base page, or via the parent stack when we're inside
  // an embedded (iframed) page.
  function openCashDisbursement() {
    const href = "/transactions/cash-disbursement";
    if (ps) ps.open(href, "Cash Disbursement");
    else if (typeof window !== "undefined" && window.parent !== window)
      window.parent.postMessage({ type: "stack:open", href, title: "Cash Disbursement" }, window.location.origin);
    else router.push(href);
  }
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function refresh() {
    const res = await fetch("/api/importations");
    const data = await res.json();
    setItems(data.importations ?? []);
  }

  useEffect(() => {
    refresh();
  }, []);

  // Live preview of the taxable/exempt base and VAT, mirroring the server math.
  const base = useMemo(
    () => (Number(form.dutiableValue) || 0) + (Number(form.charges) || 0),
    [form.dutiableValue, form.charges]
  );
  const vatPreview = form.isVatExempt ? 0 : Math.round(base * 0.12 * 100) / 100;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await fetch("/api/importations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        companyId,
        importDate: form.importDate,
        assessReleaseDate: form.assessReleaseDate,
        sellerName: form.sellerName.trim(),
        countryOrigin: form.countryOrigin.trim(),
        dutiableValue: Number(form.dutiableValue) || 0,
        charges: Number(form.charges) || 0,
        isVatExempt: form.isVatExempt,
        orNo: form.orNo.trim(),
        paymentDate: form.paymentDate,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      setError((await res.json().catch(() => ({})))?.error ?? "Could not save.");
      return;
    }
    setForm(emptyForm());
    // The importation is typically paid next — open Cash Disbursement.
    openCashDisbursement();
  }

  async function handleDelete(im: Importation) {
    if (!window.confirm(`Delete importation from "${im.sellerName}" (OR ${im.orNo})? This can't be undone.`)) return;
    const res = await fetch(`/api/importations/${im.id}`, { method: "DELETE" });
    if (res.ok) refresh();
  }

  const field = "mt-1 w-full rounded border border-neutral-300 px-2 py-1.5 text-sm";
  const label = "block text-xs text-neutral-500";

  return (
    <main className="mx-auto max-w-6xl p-4 sm:p-8">
      <div className="flex items-start justify-between gap-3">
        <h1 className="text-xl font-medium text-neutral-900">Importations</h1>
        <a href="/transactions/importations/import" className="shrink-0 rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50">Import from Excel</a>
      </div>
      <p className="mt-1 text-sm text-neutral-500">
        Record importations for the BIR Summary List of Importations (SLI). The taxable/exempt base is
        the dutiable value plus all charges before release; VAT is 12% of that base when taxable.
      </p>

      {canPost && (
        <form onSubmit={handleSubmit} className="mt-6 space-y-4 rounded-lg border border-neutral-200 p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <label className={label}>
              Date of importation
              <input type="date" required value={form.importDate} onChange={(e) => set("importDate", e.target.value)} className={field} />
            </label>
            <label className={label}>
              Assessment / release date
              <input type="date" required value={form.assessReleaseDate} onChange={(e) => set("assessReleaseDate", e.target.value)} className={field} />
            </label>
            <label className={label}>
              Country of origin
              <input required value={form.countryOrigin} onChange={(e) => set("countryOrigin", e.target.value)} className={field} />
            </label>
          </div>

          <label className={label}>
            Name of seller
            <input required value={form.sellerName} onChange={(e) => set("sellerName", e.target.value)} className={field} />
          </label>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <label className={label}>
              Dutiable value
              <input type="number" step="0.01" required value={form.dutiableValue} onChange={(e) => set("dutiableValue", e.target.value)} className={field} />
            </label>
            <label className={label}>
              All charges before release
              <input type="number" step="0.01" value={form.charges} onChange={(e) => set("charges", e.target.value)} className={field} />
            </label>
            <label className={label}>
              VAT treatment
              <select
                value={form.isVatExempt ? "exempt" : "taxable"}
                onChange={(e) => set("isVatExempt", e.target.value === "exempt")}
                className={field}
              >
                <option value="taxable">Taxable (12% VAT)</option>
                <option value="exempt">VAT-Exempt</option>
              </select>
            </label>
          </div>

          <div className="grid grid-cols-1 gap-3 rounded bg-neutral-50 p-3 text-sm sm:grid-cols-3">
            <div>
              <div className="text-xs text-neutral-400">{form.isVatExempt ? "Exempt amount" : "Taxable goods"}</div>
              <div className="font-mono">{formatPeso(base)}</div>
            </div>
            <div>
              <div className="text-xs text-neutral-400">VAT (12%)</div>
              <div className="font-mono">{formatPeso(vatPreview)}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <label className={label}>
              OR no. (of payment)
              <input required value={form.orNo} onChange={(e) => set("orNo", e.target.value)} className={field} />
            </label>
            <label className={label}>
              Date of payment
              <input type="date" required value={form.paymentDate} onChange={(e) => set("paymentDate", e.target.value)} className={field} />
            </label>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={saving}
            className="rounded bg-brand-navy px-4 py-2 text-sm text-white hover:bg-brand-navyLight disabled:opacity-50"
          >
            {saving ? "Saving…" : "Record importation"}
          </button>
        </form>
      )}

      <h2 className="mt-8 text-sm font-medium uppercase tracking-wide text-neutral-500">Recorded importations</h2>
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-neutral-400">No importations recorded yet.</p>
      ) : (
        <div className="mt-3 overflow-x-auto rounded-lg border border-neutral-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
                <th className="px-3 py-2">Import Date</th>
                <th className="px-3 py-2">Seller</th>
                <th className="px-3 py-2">Country</th>
                <th className="px-3 py-2 text-right">Dutiable</th>
                <th className="px-3 py-2 text-right">Charges</th>
                <th className="px-3 py-2">VAT</th>
                <th className="px-3 py-2 text-right">VAT Amt</th>
                <th className="px-3 py-2">OR No.</th>
                {canPost && <th className="px-3 py-2" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {items.map((im) => (
                <tr key={im.id}>
                  <td className="px-3 py-1.5 text-xs">{fmtDate(im.importDate)}</td>
                  <td className="px-3 py-1.5">{im.sellerName}</td>
                  <td className="px-3 py-1.5 text-xs text-neutral-500">{im.countryOrigin}</td>
                  <td className="px-3 py-1.5 text-right font-mono">{formatPeso(im.dutiableValue)}</td>
                  <td className="px-3 py-1.5 text-right font-mono">{formatPeso(im.charges)}</td>
                  <td className="px-3 py-1.5 text-xs">{im.isVatExempt ? "Exempt" : "Taxable"}</td>
                  <td className="px-3 py-1.5 text-right font-mono">{formatPeso(im.vatAmount)}</td>
                  <td className="px-3 py-1.5 font-mono text-xs">{im.orNo}</td>
                  {canPost && (
                    <td className="px-3 py-1.5 text-right">
                      <button onClick={() => handleDelete(im)} className="text-xs text-red-600 hover:underline">
                        Delete
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
