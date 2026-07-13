"use client";

import { useMemo, useState } from "react";
import { formatPeso } from "@/lib/format";
import { useLastBranch } from "@/lib/useLastBranch";
import { branchOptionLabel } from "@/lib/branchLabel";
import { computeVat, computeWithholding } from "@/lib/vat";
import type { Account, AtcCode, Contact, CounterpartyType, Customer, Employee, Location, TaxSource, Vendor, VatType } from "@prisma/client";
import { CounterpartyPicker } from "@/components/CounterpartyPicker";
import { TransactionSearch } from "@/components/TransactionSearch";

type LineState = { key: string; accountId: string; vatType: VatType; amount: number; amountIsGross: boolean; atcCodeId: string | null; taxSource: TaxSource; referenceNo: string };
type Attachment = { fileName: string; contentType: string; sizeBytes: number; data: string };

const VAT_LABEL: Partial<Record<VatType, string>> = { VAT_12: "12% VAT", ZERO_RATED: "Zero-Rated", VAT_EXEMPT: "VAT Exempt", NON_VAT: "Non-VAT" };
const NATURE_LABEL: Record<TaxSource, string> = { GOODS: "Goods", SERVICE: "Services", CAPITAL_GOODS: "Capital Goods" };
const uid = () => crypto.randomUUID();
const newLine = (): LineState => ({ key: uid(), accountId: "", vatType: "NON_VAT", amount: 0, amountIsGross: true, atcCodeId: null, taxSource: "GOODS", referenceNo: "" });
const fileSize = (n: number) => (n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(0)} KB` : `${(n / 1048576).toFixed(1)} MB`);
const MAX_FILE = 3_000_000;

type Payor = { name: string; tin: string; address: string; zip: string };

export function CashDisbursementForm({ companyId, companyPayor, accounts, cashAccounts, vendors, employees, contacts, customers, atcCodes, locations, suggestedDocumentNo }: {
  companyId: string; companyPayor: Payor; accounts: Account[]; cashAccounts: Account[]; vendors: Vendor[]; employees: Employee[]; contacts: Contact[]; customers: Customer[]; atcCodes: AtcCode[]; locations: Location[]; suggestedDocumentNo: string;
}) {
  const [postingDate, setPostingDate] = useState(new Date().toISOString().slice(0, 10));
  const [locationId, setLocationId] = useLastBranch(companyId, locations);
  const [documentNo, setDocumentNo] = useState(suggestedDocumentNo);
  const [checkNo, setCheckNo] = useState("");
  const [counterpartyType, setCounterpartyType] = useState<CounterpartyType | null>("VENDOR");
  const [counterpartyId, setCounterpartyId] = useState<string | null>(null);
  const [cashAccountId, setCashAccountId] = useState(cashAccounts[0]?.id ?? "");
  const [particulars, setParticulars] = useState("");
  const [lines, setLines] = useState<LineState[]>([newLine()]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [attachError, setAttachError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [posted, setPosted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [vendorList, setVendorList] = useState(vendors);
  const [employeeList, setEmployeeList] = useState(employees);
  const [contactList, setContactList] = useState(contacts);
  const [customerList, setCustomerList] = useState(customers);

  const atcById = useMemo(() => new Map(atcCodes.map((a) => [a.id, a])), [atcCodes]);
  function onPartyCreated(type: CounterpartyType, record: Vendor | Employee | Contact | Customer) {
    if (type === "VENDOR") setVendorList((l) => [...l, record as Vendor]);
    else if (type === "EMPLOYEE") setEmployeeList((l) => [...l, record as Employee]);
    else if (type === "CONTACT") setContactList((l) => [...l, record as Contact]);
    else setCustomerList((l) => [...l, record as Customer]);
    setCounterpartyId(record.id);
  }
  const updateLine = (key: string, patch: Partial<LineState>) => setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const addLine = () => setLines((prev) => [...prev, newLine()]);
  const removeLine = (key: string) => setLines((prev) => (prev.length > 1 ? prev.filter((l) => l.key !== key) : prev));
  const clearLines = () => { if (window.confirm("Clear all lines? This removes every line you've entered.")) setLines([newLine()]); };
  function visibleAtc(taxSource: TaxSource, selectedId: string | null) {
    const wanted = taxSource === "SERVICE" ? "SERVICES" : "GOODS";
    return atcCodes.filter((a) => a.incomePaymentType === "BOTH" || a.incomePaymentType === wanted || a.id === selectedId);
  }

  const computed = useMemo(() => {
    const rows = lines.map((l) => {
      const vat = computeVat({ vatType: l.vatType, amount: l.amount || 0, amountIsGross: l.amountIsGross });
      const atc = l.atcCodeId ? atcById.get(l.atcCodeId) : null;
      const withholdingAmt = atc ? computeWithholding(vat.netAmount, Number(atc.ratePercent)) : 0;
      return { ...l, net: vat.netAmount, vat: vat.vatAmount, withholdingAmt };
    });
    const totalDebit = Math.round(rows.reduce((s, r) => s + r.net + r.vat, 0) * 100) / 100;
    const totalWithholding = Math.round(rows.reduce((s, r) => s + r.withholdingAmt, 0) * 100) / 100;
    return { rows, totalDebit, totalWithholding, cashAmount: Math.round((totalDebit - totalWithholding) * 100) / 100 };
  }, [lines, atcById]);

  async function onFiles(fileList: FileList | null) {
    if (!fileList) return;
    setAttachError(null);
    for (const f of Array.from(fileList)) {
      if (f.size > MAX_FILE) { setAttachError(`"${f.name}" is too large (max 3 MB).`); continue; }
      const data = await new Promise<string>((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(r.result as string); r.onerror = reject; r.readAsDataURL(f); });
      setAttachments((prev) => [...prev, { fileName: f.name, contentType: f.type, sizeBytes: f.size, data }]);
    }
  }

  // Print BIR 2307 from the currently-entered data without posting: payee is
  // the payee/supplier, payor is the company (withholding agent).
  function print2307() {
    const map = new Map<string, { atc: string; description: string; income: number; tax: number }>();
    for (const r of computed.rows) {
      if (!r.atcCodeId || r.withholdingAmt <= 0) continue;
      const atc = atcById.get(r.atcCodeId);
      const key = atc?.code ?? "—";
      const existing = map.get(key);
      if (existing) { existing.income += r.net; existing.tax += r.withholdingAmt; }
      else map.set(key, { atc: atc?.code ?? "", description: atc?.description ?? "", income: r.net, tax: r.withholdingAmt });
    }
    const lists: Record<string, Array<Record<string, unknown>>> = {
      CUSTOMER: customerList as unknown as Array<Record<string, unknown>>,
      VENDOR: vendorList as unknown as Array<Record<string, unknown>>,
      EMPLOYEE: employeeList as unknown as Array<Record<string, unknown>>,
      CONTACT: contactList as unknown as Array<Record<string, unknown>>,
    };
    const party = counterpartyType && counterpartyId ? lists[counterpartyType]?.find((x) => x.id === counterpartyId) : null;
    const s = (v: unknown) => (typeof v === "string" ? v : "");
    const payeeObj = party
      ? {
          name: s(party.registeredName) || s(party.tradeName) || [s(party.lastName), s(party.firstName)].filter(Boolean).join(", "),
          tin: s(party.tin),
          address: s(party.address),
          zip: "",
        }
      : { name: "", tin: "", address: "", zip: "" };
    const payload = { payee: payeeObj, payor: companyPayor, postingDate, documentNo, rows: [...map.values()] };
    localStorage.setItem("arbixo_2307_preview", JSON.stringify(payload));
    window.open("/transactions/2307/preview?_embed=1", "_blank");
  }

  async function resetForm() {
    const nextRes = await fetch(`/api/ledger-entries/next-document-no?companyId=${companyId}&journalType=CASH_DISBURSEMENT`);
    const nextData = await nextRes.json();
    setDocumentNo(nextData.documentNo);
    setCheckNo(""); setCounterpartyId(null); setParticulars(""); setLines([newLine()]); setAttachments([]); setAttachError(null);
    setPosted(false); setError(null); setSuccess(null);
  }

  async function post(retain: boolean, printVoucher = false) {
    setSaving(true); setError(null); setSuccess(null);
    const payload = {
      companyId, locationId: locationId || null, documentNo, checkNo: checkNo || null, postingDate,
      counterpartyType, counterpartyId, cashAccountId, particulars,
      lines: lines.map((l) => ({ accountId: l.accountId, amount: l.amount, vatType: l.vatType, amountIsGross: l.amountIsGross, atcCodeId: l.atcCodeId, taxSource: l.taxSource, referenceNo: l.referenceNo || null })),
      attachments,
    };
    const res = await fetch("/api/ledger-entries/cash-disbursement", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    setSaving(false);
    if (!res.ok) { const data = await res.json().catch(() => ({})); setError(data.error ?? "Something went wrong posting this entry."); return; }
    setSuccess(`Posted CV ${documentNo}.`);
    if (printVoucher) window.open(`/transactions/voucher/CASH_DISBURSEMENT/${encodeURIComponent(documentNo)}?_embed=1`, "_blank");
    if (retain) { setPosted(true); return; }
    await resetForm();
  }
  function handleSubmit(e: React.FormEvent) { e.preventDefault(); post(false); }

  const field = "mt-1 w-full rounded border border-neutral-300 px-2 py-1.5 text-sm";
  const label = "block text-xs text-neutral-500";
  const cell = "border-b border-neutral-100 px-2 py-1";

  return (
    <main className="mx-auto max-w-7xl p-4 sm:p-8">
      <div className="flex items-start justify-between gap-3">
        <h1 className="text-xl font-medium text-neutral-900">Cash Disbursement</h1>
        <div className="flex shrink-0 items-center gap-2">
          <TransactionSearch companyId={companyId} journalType="CASH_DISBURSEMENT" title="Cash Disbursement — search" />
          <a href="/transactions/cash-disbursement/import" className="shrink-0 rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50">Import from Excel</a>
        </div>
      </div>
      <p className="mt-1 text-sm text-neutral-500">Every peso paid out — check disbursements, cash purchases, expense payments.</p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-6">
        <div className="grid grid-cols-1 gap-3 rounded-lg border border-neutral-200 p-4 sm:grid-cols-4">
          <label className={label}>Date<input type="date" required value={postingDate} onChange={(e) => setPostingDate(e.target.value)} className={field} /></label>
          <label className={label}>CV no.<input required value={documentNo} onChange={(e) => setDocumentNo(e.target.value)} className={`${field} font-mono`} /></label>
          <label className={label}>Check no. (optional)<input value={checkNo} onChange={(e) => setCheckNo(e.target.value)} className={field} /></label>
          <label className={label}>Branch<select value={locationId} onChange={(e) => setLocationId(e.target.value)} className={field}><option value="">—</option>{locations.map((l) => <option key={l.id} value={l.id}>{branchOptionLabel(l)}</option>)}</select></label>

          <div className="sm:col-span-4">
            <CounterpartyPicker counterpartyType={counterpartyType} counterpartyId={counterpartyId} onTypeChange={setCounterpartyType} onIdChange={setCounterpartyId} vendors={vendorList} employees={employeeList} contacts={contactList} customers={customerList} label="Payee" companyId={companyId} onCreated={onPartyCreated} />
          </div>
          <label className={label}>Cash account<select required value={cashAccountId} onChange={(e) => setCashAccountId(e.target.value)} className={field}>{cashAccounts.length === 0 && <option value="">No Cash accounts yet</option>}{cashAccounts.map((a) => <option key={a.id} value={a.id}>{a.code} — {a.title}</option>)}</select></label>
          <label className="block text-xs text-neutral-500 sm:col-span-4">Particulars<input value={particulars} onChange={(e) => setParticulars(e.target.value)} className={field} /></label>

          <div className="sm:col-span-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xs text-neutral-500">Attachments</span>
              <label className="cursor-pointer rounded border border-neutral-300 px-3 py-1 text-xs text-neutral-700 hover:bg-neutral-50">+ Add file
                <input type="file" multiple accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,.xlsx,.xls,.csv,.doc,.docx" className="hidden" onChange={(e) => { onFiles(e.target.files); e.currentTarget.value = ""; }} />
              </label>
              <span className="text-[11px] text-neutral-400">PDF, image, Excel, Word — max 3 MB each.</span>
            </div>
            {attachments.length > 0 && (
              <ul className="mt-2 flex flex-wrap gap-2">
                {attachments.map((a, i) => (
                  <li key={i} className="flex items-center gap-2 rounded border border-neutral-200 bg-neutral-50 px-2 py-1 text-xs"><span className="max-w-[200px] truncate">{a.fileName}</span><span className="text-neutral-400">{fileSize(a.sizeBytes)}</span><button type="button" onClick={() => setAttachments((prev) => prev.filter((_, j) => j !== i))} className="text-red-500 hover:text-red-700">✕</button></li>
                ))}
              </ul>
            )}
            {attachError && <p className="mt-1 text-xs text-red-600">{attachError}</p>}
          </div>
        </div>

        <div>
          <div className="mb-2"><h2 className="text-sm font-medium text-neutral-900">Lines</h2></div>
          <div className="overflow-x-auto rounded-lg border border-neutral-200">
            <table className="w-full min-w-[900px] text-xs">
              <thead>
                <tr className="bg-neutral-50 text-left text-neutral-500">
                  <th className={cell}>Account</th><th className={cell}>Ref No.</th><th className={cell}>Nature</th><th className={cell}>VAT</th><th className={cell}>Amount</th><th className={cell}>Gross/Net</th><th className={cell}>ATC</th>
                  <th className={`${cell} text-right`}>Net</th><th className={`${cell} text-right`}>VAT</th><th className={`${cell} text-right`}>W/tax</th><th className={`${cell} text-right`}><button type="button" onClick={clearLines} className="font-medium text-red-600 hover:underline">Clear</button></th>
                </tr>
              </thead>
              <tbody>
                {computed.rows.map((r) => (
                  <tr key={r.key}>
                    <td className={cell}><select required value={r.accountId} onChange={(e) => updateLine(r.key, { accountId: e.target.value })} className="w-44 rounded border border-neutral-300 px-1 py-1"><option value="">Select…</option>{accounts.map((a) => <option key={a.id} value={a.id}>{a.code} — {a.title}</option>)}</select></td>
                    <td className={cell}><input value={r.referenceNo} onChange={(e) => updateLine(r.key, { referenceNo: e.target.value })} className="w-28 rounded border border-neutral-300 px-1 py-1" /></td>
                    <td className={cell}><select value={r.taxSource} onChange={(e) => updateLine(r.key, { taxSource: e.target.value as TaxSource })} className="w-28 rounded border border-neutral-300 px-1 py-1">{Object.entries(NATURE_LABEL).map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select></td>
                    <td className={cell}><select value={r.vatType} onChange={(e) => updateLine(r.key, { vatType: e.target.value as VatType })} className="w-24 rounded border border-neutral-300 px-1 py-1">{Object.entries(VAT_LABEL).map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select></td>
                    <td className={cell}><input type="number" step="0.01" value={r.amount || ""} onChange={(e) => updateLine(r.key, { amount: Number(e.target.value) })} className="w-24 rounded border border-neutral-300 px-1 py-1" /></td>
                    <td className={cell}><select value={r.amountIsGross ? "gross" : "net"} disabled={r.vatType !== "VAT_12"} onChange={(e) => updateLine(r.key, { amountIsGross: e.target.value === "gross" })} className="w-20 rounded border border-neutral-300 px-1 py-1 disabled:bg-neutral-100"><option value="gross">Gross</option><option value="net">Net</option></select></td>
                    <td className={cell}><select value={r.atcCodeId ?? ""} onChange={(e) => updateLine(r.key, { atcCodeId: e.target.value || null })} className="w-36 rounded border border-neutral-300 px-1 py-1"><option value="">None</option>{visibleAtc(r.taxSource, r.atcCodeId).map((a) => <option key={a.id} value={a.id}>{a.code} ({Number(a.ratePercent)}%)</option>)}</select></td>
                    <td className={`${cell} text-right font-mono`}>{formatPeso(r.net)}</td>
                    <td className={`${cell} text-right font-mono`}>{formatPeso(r.vat)}</td>
                    <td className={`${cell} text-right font-mono`}>{formatPeso(r.withholdingAmt)}</td>
                    <td className={cell}>{lines.length > 1 && <button type="button" onClick={() => removeLine(r.key)} className="text-red-500 hover:text-red-700">✕</button>}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-neutral-50 font-medium"><td className={cell} colSpan={7}>Totals</td><td className={`${cell} text-right font-mono`} colSpan={2}>Debit {formatPeso(computed.totalDebit)}</td><td className={`${cell} text-right font-mono`}>{formatPeso(computed.totalWithholding)}</td><td className={cell}></td></tr>
              </tfoot>
            </table>
          </div>
          <button type="button" onClick={addLine} className="mt-2 text-xs text-brand-blue hover:underline">+ Add line</button>
        </div>

        <div className="grid grid-cols-1 gap-3 rounded-lg bg-neutral-50 p-4 text-sm sm:grid-cols-3">
          <div><div className="text-xs text-neutral-400">Total debit</div><div className="font-mono">{formatPeso(computed.totalDebit)}</div></div>
          <div><div className="text-xs text-neutral-400">Withholding</div><div className="font-mono">{formatPeso(computed.totalWithholding)}</div></div>
          <div><div className="text-xs text-neutral-400">Cash (credit)</div><div className="font-mono font-medium">{formatPeso(computed.cashAmount)}</div></div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        {success && <p className="text-sm text-green-600">{success}</p>}

        <div className="flex gap-2">
          <button type="submit" disabled={saving || posted} className="rounded bg-[#0B2A5E] px-4 py-2 text-sm text-white hover:bg-[#123A73] disabled:opacity-50">{saving ? "Posting…" : "Save & new"}</button>
          <button type="button" onClick={() => post(true)} disabled={saving || posted} className="rounded border border-brand-blue px-4 py-2 text-sm font-medium text-brand-blue hover:bg-blue-50 disabled:opacity-50">Save</button>
          <button type="button" onClick={() => post(false, true)} disabled={saving || posted} className="rounded border border-brand-blue px-4 py-2 text-sm font-medium text-brand-blue hover:bg-blue-50 disabled:opacity-50">Save &amp; Print</button>
          <button type="button" onClick={print2307} disabled={saving} className="rounded border border-brand-blue px-4 py-2 text-sm font-medium text-brand-blue hover:bg-blue-50 disabled:opacity-50">Print 2307</button>
          {posted && <button type="button" onClick={resetForm} className="rounded border border-neutral-300 px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-50">New</button>}
        </div>
      </form>
    </main>
  );
}
