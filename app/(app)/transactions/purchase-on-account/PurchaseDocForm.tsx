"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { formatPeso } from "@/lib/format";

type VatType = "VAT_12" | "ZERO_RATED" | "VAT_EXEMPT" | "NON_VAT";
export type Vendor = { id: string; code: string; name: string; tin: string | null };
export type ItemLite = { id: string; code: string; description: string; type: "INVENTORY" | "NON_INVENTORY" | "SERVICE"; uom: string | null; defaultCost: number; vatType: VatType; inventoryAccountId: string | null; expenseAccountId: string | null };
export type AccountLite = { id: string; code: string; title: string; classification: string };
export type Branch = { id: string; name: string; branchCode: string | null };

export type InitialDoc = {
  id: string; transactionNo: string; transactionDate: string; vendorId: string | null; supplierTin: string | null;
  locationId: string | null; terms: string | null; dueDate: string | null; referenceNo: string | null;
  purchaseOrderNo: string | null; currency: string; remarks: string | null; payableAccountId: string | null;
  lines: { itemId: string | null; itemCode: string | null; description: string; quantity: number; uom: string | null; unitCost: number; discountPercent: number; vatType: VatType; accountId: string | null }[];
};

type Line = { key: string; itemId: string; description: string; quantity: number; uom: string; unitCost: number; discountPercent: number; vatType: VatType; accountId: string };

const TERMS = ["Due on receipt", "7 Days", "15 Days", "30 Days", "45 Days", "60 Days"];
const VAT_LABEL: Record<VatType, string> = { VAT_12: "Vatable 12%", ZERO_RATED: "Zero-Rated", VAT_EXEMPT: "VAT Exempt", NON_VAT: "Non-VAT" };
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const uid = () => (globalThis.crypto?.randomUUID?.() ?? String(Math.random())).slice(0, 12);

function termDays(t: string): number | null {
  const m = t.match(/(\d+)/);
  return m ? Number(m[1]) : t === "Due on receipt" ? 0 : null;
}
function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function PurchaseDocForm({
  initial, vendors, items, accounts, branches, inputVatAccountId, suggestedNo,
}: {
  initial?: InitialDoc;
  vendors: Vendor[];
  items: ItemLite[];
  accounts: AccountLite[];
  branches: Branch[];
  inputVatAccountId: string | null;
  suggestedNo: string;
}) {
  const router = useRouter();
  const apAccounts = accounts.filter((a) => a.classification === "ACCOUNTS_PAYABLE");
  const acctById = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);
  const itemById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);

  const [transactionNo, setTransactionNo] = useState(initial?.transactionNo ?? suggestedNo);
  const [transactionDate, setTransactionDate] = useState(initial?.transactionDate ?? new Date().toISOString().slice(0, 10));
  const [vendorId, setVendorId] = useState(initial?.vendorId ?? "");
  const [supplierTin, setSupplierTin] = useState(initial?.supplierTin ?? "");
  const [terms, setTerms] = useState(initial?.terms ?? "30 Days");
  const [dueDate, setDueDate] = useState(initial?.dueDate ?? "");
  const [referenceNo, setReferenceNo] = useState(initial?.referenceNo ?? "");
  const [purchaseOrderNo, setPurchaseOrderNo] = useState(initial?.purchaseOrderNo ?? "");
  const [locationId, setLocationId] = useState(initial?.locationId ?? "");
  const [payableAccountId, setPayableAccountId] = useState(initial?.payableAccountId ?? apAccounts[0]?.id ?? "");
  const [remarks, setRemarks] = useState(initial?.remarks ?? "");
  const [lines, setLines] = useState<Line[]>(
    initial?.lines.length
      ? initial.lines.map((l) => ({ key: uid(), itemId: l.itemId ?? "", description: l.description, quantity: l.quantity, uom: l.uom ?? "", unitCost: l.unitCost, discountPercent: l.discountPercent, vatType: l.vatType, accountId: l.accountId ?? "" }))
      : [{ key: uid(), itemId: "", description: "", quantity: 1, uom: "", unitCost: 0, discountPercent: 0, vatType: "VAT_12", accountId: "" }]
  );
  const [busy, setBusy] = useState<null | "draft" | "post">(null);
  const [error, setError] = useState<string | null>(null);

  function pickVendor(id: string) {
    setVendorId(id);
    const v = vendors.find((x) => x.id === id);
    if (v) setSupplierTin(v.tin ?? "");
  }
  function pickTerms(t: string) {
    setTerms(t);
    const d = termDays(t);
    if (d != null && transactionDate) setDueDate(addDays(transactionDate, d));
  }
  function updateLine(key: string, patch: Partial<Line>) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }
  function pickItem(key: string, itemId: string) {
    const it = itemId ? itemById.get(itemId) : null;
    if (!it) return updateLine(key, { itemId: "" });
    updateLine(key, {
      itemId, description: it.description, uom: it.uom ?? "", unitCost: Number(it.defaultCost), vatType: it.vatType,
      accountId: (it.type === "INVENTORY" ? it.inventoryAccountId : it.expenseAccountId) ?? "",
    });
  }
  const addLine = () => setLines((p) => [...p, { key: uid(), itemId: "", description: "", quantity: 1, uom: "", unitCost: 0, discountPercent: 0, vatType: "VAT_12", accountId: "" }]);
  const removeLine = (key: string) => setLines((p) => (p.length > 1 ? p.filter((l) => l.key !== key) : p));

  const computed = useMemo(() => {
    const rows = lines.map((l) => {
      const net = round2(l.quantity * l.unitCost * (1 - l.discountPercent / 100));
      const vat = l.vatType === "VAT_12" ? round2(net * 0.12) : 0;
      const it = l.itemId ? itemById.get(l.itemId) : null;
      const accountId = it ? (it.type === "INVENTORY" ? it.inventoryAccountId : it.expenseAccountId) ?? "" : l.accountId;
      return { ...l, net, vat, incVat: round2(net + vat), accountId };
    });
    const totalBeforeVat = round2(rows.reduce((s, r) => s + r.net, 0));
    const totalVat = round2(rows.reduce((s, r) => s + r.vat, 0));
    const totalAmount = round2(totalBeforeVat + totalVat);
    // Journal entry preview: net grouped by account (debits) + Input VAT + AP.
    const byAcct = new Map<string, number>();
    for (const r of rows) if (r.net > 0) byAcct.set(r.accountId, round2((byAcct.get(r.accountId) ?? 0) + r.net));
    const je: { title: string; dr: number; cr: number }[] = [];
    for (const [aid, amt] of byAcct) je.push({ title: aid ? (acctById.get(aid)?.title ?? "(unknown account)") : "(no account)", dr: amt, cr: 0 });
    if (totalVat > 0) je.push({ title: inputVatAccountId ? (acctById.get(inputVatAccountId)?.title ?? "Input VAT") : "Input VAT (not configured)", dr: totalVat, cr: 0 });
    je.push({ title: payableAccountId ? (acctById.get(payableAccountId)?.title ?? "Accounts Payable") : "Accounts Payable (not set)", dr: 0, cr: totalAmount });
    return { rows, totalBeforeVat, totalVat, totalAmount, je };
  }, [lines, itemById, acctById, inputVatAccountId, payableAccountId]);

  async function submit(post: boolean) {
    setBusy(post ? "post" : "draft");
    setError(null);
    const body = {
      post, transactionNo, transactionDate, vendorId: vendorId || null, supplierTin, locationId: locationId || null,
      terms, dueDate: dueDate || null, referenceNo, purchaseOrderNo, currency: "PHP", remarks,
      payableAccountId: payableAccountId || null,
      lines: lines.map((l) => ({ itemId: l.itemId || null, itemCode: l.itemId ? itemById.get(l.itemId)?.code : null, description: l.description, quantity: l.quantity, uom: l.uom, unitCost: l.unitCost, discountPercent: l.discountPercent, vatType: l.vatType, accountId: l.accountId || null })),
    };
    const url = initial ? `/api/purchase-docs/${initial.id}` : "/api/purchase-docs";
    const res = await fetch(url, { method: initial ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok || data.error) { setError(data.error ?? "Could not save."); return; }
    router.push("/transactions/purchase-on-account");
    router.refresh();
  }

  const field = "mt-1 w-full rounded border border-neutral-300 px-2 py-1.5 text-sm";
  const label = "block text-xs text-neutral-500";
  const cell = "border-b border-neutral-100 px-2 py-1";

  return (
    <main className="mx-auto max-w-6xl p-4 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-medium text-neutral-900">Purchase Order {initial ? `· ${initial.transactionNo}` : ""}</h1>
        <div className="flex gap-2">
          <button onClick={() => router.push("/transactions/purchase-on-account")} className="rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50">Cancel</button>
          <button onClick={() => submit(false)} disabled={!!busy} className="rounded border border-brand-blue px-3 py-1.5 text-sm font-medium text-brand-blue hover:bg-blue-50 disabled:opacity-50">{busy === "draft" ? "Saving…" : "Save Draft"}</button>
          <button onClick={() => submit(true)} disabled={!!busy} className="rounded bg-[#0B2A5E] px-4 py-1.5 text-sm text-white hover:bg-[#123A73] disabled:opacity-50">{busy === "post" ? "Posting…" : "Save & Post"}</button>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Header */}
          <div className="grid grid-cols-2 gap-3 rounded-lg border border-neutral-200 p-4 sm:grid-cols-3">
            <label className={label}>Transaction No.<input value={transactionNo} onChange={(e) => setTransactionNo(e.target.value)} className={`${field} font-mono`} /></label>
            <label className={label}>Transaction Date<input type="date" value={transactionDate} onChange={(e) => { setTransactionDate(e.target.value); const d = termDays(terms); if (d != null) setDueDate(addDays(e.target.value, d)); }} className={field} /></label>
            <label className={label}>Supplier<select value={vendorId} onChange={(e) => pickVendor(e.target.value)} className={field}><option value="">—</option>{vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}</select></label>
            <label className={label}>Supplier TIN<input value={supplierTin} onChange={(e) => setSupplierTin(e.target.value)} className={`${field} font-mono`} /></label>
            <label className={label}>Terms<select value={terms} onChange={(e) => pickTerms(e.target.value)} className={field}>{TERMS.map((t) => <option key={t} value={t}>{t}</option>)}</select></label>
            <label className={label}>Due Date<input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={field} /></label>
            <label className={label}>Reference No. (supplier invoice)<input value={referenceNo} onChange={(e) => setReferenceNo(e.target.value)} className={field} /></label>
            <label className={label}>Purchase Order No.<input value={purchaseOrderNo} onChange={(e) => setPurchaseOrderNo(e.target.value)} className={field} /></label>
            <label className={label}>Branch<select value={locationId} onChange={(e) => setLocationId(e.target.value)} className={field}><option value="">—</option>{branches.map((b) => <option key={b.id} value={b.id}>{(b.branchCode ?? "").replace(/\D/g, "").padStart(5, "0")} — {b.name}</option>)}</select></label>
            <label className={label}>Payment Account (A/P)<select value={payableAccountId} onChange={(e) => setPayableAccountId(e.target.value)} className={field}><option value="">—</option>{apAccounts.map((a) => <option key={a.id} value={a.id}>{a.code} — {a.title}</option>)}</select></label>
            <label className={`${label} sm:col-span-3`}>Remarks / Description<input value={remarks} onChange={(e) => setRemarks(e.target.value)} className={field} /></label>
          </div>

          {/* Items */}
          <div className="rounded-lg border border-neutral-200 p-4">
            <div className="mb-2 flex items-center justify-between"><h2 className="text-sm font-medium text-neutral-900">Items</h2><button onClick={addLine} className="text-xs text-brand-blue hover:underline">+ Add Item</button></div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-xs">
                <thead><tr className="text-left text-neutral-500">
                  <th className={cell}>Item</th><th className={cell}>Description</th><th className={cell}>Qty</th><th className={cell}>UOM</th><th className={cell}>Unit Cost</th><th className={cell}>Disc %</th><th className={`${cell} text-right`}>Amount</th><th className={cell}>VAT</th><th className={`${cell} text-right`}>Inc VAT</th><th className={cell}></th>
                </tr></thead>
                <tbody>
                  {computed.rows.map((r) => (
                    <tr key={r.key}>
                      <td className={cell}><select value={r.itemId} onChange={(e) => pickItem(r.key, e.target.value)} className="w-32 rounded border border-neutral-300 px-1 py-1"><option value="">— free —</option>{items.map((i) => <option key={i.id} value={i.id}>{i.code}</option>)}</select></td>
                      <td className={cell}><input value={r.description} onChange={(e) => updateLine(r.key, { description: e.target.value })} className="w-40 rounded border border-neutral-300 px-1 py-1" /></td>
                      <td className={cell}><input type="number" value={r.quantity} onChange={(e) => updateLine(r.key, { quantity: Number(e.target.value) })} className="w-16 rounded border border-neutral-300 px-1 py-1" /></td>
                      <td className={cell}><input value={r.uom} onChange={(e) => updateLine(r.key, { uom: e.target.value })} className="w-14 rounded border border-neutral-300 px-1 py-1" /></td>
                      <td className={cell}><input type="number" value={r.unitCost} onChange={(e) => updateLine(r.key, { unitCost: Number(e.target.value) })} className="w-20 rounded border border-neutral-300 px-1 py-1" /></td>
                      <td className={cell}><input type="number" value={r.discountPercent} onChange={(e) => updateLine(r.key, { discountPercent: Number(e.target.value) })} className="w-14 rounded border border-neutral-300 px-1 py-1" /></td>
                      <td className={`${cell} text-right font-mono`}>{formatPeso(r.net)}</td>
                      <td className={cell}><select value={r.vatType} onChange={(e) => updateLine(r.key, { vatType: e.target.value as VatType })} className="w-24 rounded border border-neutral-300 px-1 py-1">{Object.entries(VAT_LABEL).map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select></td>
                      <td className={`${cell} text-right font-mono`}>{formatPeso(r.incVat)}</td>
                      <td className={cell}><button onClick={() => removeLine(r.key)} className="text-red-500 hover:text-red-700">✕</button></td>
                    </tr>
                  ))}
                </tbody>
                <tfoot><tr className="font-medium"><td className={cell} colSpan={6}>Totals</td><td className={`${cell} text-right font-mono`}>{formatPeso(computed.totalBeforeVat)}</td><td className={cell}>VAT {formatPeso(computed.totalVat)}</td><td className={`${cell} text-right font-mono`}>{formatPeso(computed.totalAmount)}</td><td className={cell}></td></tr></tfoot>
              </table>
            </div>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        {/* Right rail: summary + JE preview */}
        <div className="space-y-6">
          <div className="rounded-lg border border-neutral-200 p-4 text-sm">
            <h2 className="mb-3 text-sm font-medium text-brand-blue">Transaction Summary</h2>
            <Row k="Total (Before VAT)" v={computed.totalBeforeVat} />
            <Row k="Total VAT" v={computed.totalVat} />
            <div className="my-2 border-t border-neutral-100" />
            <div className="flex justify-between font-medium"><span>Total Amount</span><span className="font-mono">{formatPeso(computed.totalAmount)}</span></div>
            <div className="mt-1 flex justify-between text-brand-blue"><span>Amount Due</span><span className="font-mono font-semibold">{formatPeso(computed.totalAmount)}</span></div>
          </div>

          <div className="rounded-lg border border-neutral-200 p-4 text-sm">
            <h2 className="mb-3 text-sm font-medium text-brand-blue">Journal Entry Preview</h2>
            <table className="w-full text-xs">
              <thead><tr className="text-left text-neutral-500"><th className="pb-1">Account</th><th className="pb-1 text-right">Dr.</th><th className="pb-1 text-right">Cr.</th></tr></thead>
              <tbody>
                {computed.je.map((r, i) => (
                  <tr key={i}><td className="py-0.5 pr-2">{r.title}</td><td className="py-0.5 text-right font-mono">{r.dr ? formatPeso(r.dr) : "-"}</td><td className="py-0.5 text-right font-mono">{r.cr ? formatPeso(r.cr) : "-"}</td></tr>
                ))}
              </tbody>
              <tfoot><tr className="border-t border-neutral-200 font-medium text-brand-blue"><td className="pt-1">TOTAL</td><td className="pt-1 text-right font-mono">{formatPeso(computed.totalAmount)}</td><td className="pt-1 text-right font-mono">{formatPeso(computed.totalAmount)}</td></tr></tfoot>
            </table>
          </div>
        </div>
      </div>
    </main>
  );
}

function Row({ k, v }: { k: string; v: number }) {
  return <div className="flex justify-between text-neutral-600"><span>{k}</span><span className="font-mono">{formatPeso(v)}</span></div>;
}
