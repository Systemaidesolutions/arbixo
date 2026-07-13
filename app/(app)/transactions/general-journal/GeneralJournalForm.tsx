"use client";

import { Fragment, useMemo, useState } from "react";
import { formatPeso } from "@/lib/format";
import { useLastBranch } from "@/lib/useLastBranch";
import { branchOptionLabel } from "@/lib/branchLabel";
import type { Account, AtcCode, Contact, CounterpartyType, Customer, Employee, Location, Vendor, VatType } from "@prisma/client";
import { VatComputationFields, type VatComputationValue } from "@/components/VatComputationFields";
import { CounterpartyPicker } from "@/components/CounterpartyPicker";

type LineState = {
  key: string; accountId: string; debitAmount: number; creditAmount: number; description: string; referenceNo: string; expanded: boolean;
  showParty: boolean; counterpartyType: CounterpartyType | null; counterpartyId: string | null;
  showVatInfo: boolean; vatType: VatType; vatInputAmount: number; amountIsGross: boolean; atcCodeId: string | null; vatComputed: VatComputationValue | null;
};
type Attachment = { fileName: string; contentType: string; sizeBytes: number; data: string };

const uid = () => crypto.randomUUID();
function newLine(): LineState {
  return { key: uid(), accountId: "", debitAmount: 0, creditAmount: 0, description: "", referenceNo: "", expanded: false, showParty: false, counterpartyType: null, counterpartyId: null, showVatInfo: false, vatType: "NON_VAT", vatInputAmount: 0, amountIsGross: true, atcCodeId: null, vatComputed: null };
}
const fileSize = (n: number) => (n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(0)} KB` : `${(n / 1048576).toFixed(1)} MB`);
const MAX_FILE = 3_000_000;

export function GeneralJournalForm({ companyId, accounts, vendors, employees, contacts, customers, atcCodes, locations, suggestedDocumentNo }: {
  companyId: string; accounts: Account[]; vendors: Vendor[]; employees: Employee[]; contacts: Contact[]; customers: Customer[]; atcCodes: AtcCode[]; locations: Location[]; suggestedDocumentNo: string;
}) {
  const [postingDate, setPostingDate] = useState(new Date().toISOString().slice(0, 10));
  const [locationId, setLocationId] = useLastBranch(companyId, locations);
  const [documentNo, setDocumentNo] = useState(suggestedDocumentNo);
  const [particulars, setParticulars] = useState("");
  const [lines, setLines] = useState<LineState[]>([newLine(), newLine()]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [attachError, setAttachError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [vendorList, setVendorList] = useState(vendors);
  const [employeeList, setEmployeeList] = useState(employees);
  const [contactList, setContactList] = useState(contacts);
  const [customerList, setCustomerList] = useState(customers);

  function appendParty(type: CounterpartyType, record: Vendor | Employee | Contact | Customer) {
    if (type === "VENDOR") setVendorList((l) => [...l, record as Vendor]);
    else if (type === "EMPLOYEE") setEmployeeList((l) => [...l, record as Employee]);
    else if (type === "CONTACT") setContactList((l) => [...l, record as Contact]);
    else setCustomerList((l) => [...l, record as Customer]);
  }
  const updateLine = (key: string, patch: Partial<LineState>) => setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const addLine = () => setLines((prev) => [...prev, newLine()]);
  const removeLine = (key: string) => setLines((prev) => (prev.length > 2 ? prev.filter((l) => l.key !== key) : prev));
  const clearLines = () => { if (window.confirm("Clear all lines? This removes every line you've entered.")) setLines([newLine(), newLine()]); };

  const totals = useMemo(() => {
    const totalDebit = lines.reduce((s, l) => s + (l.debitAmount || 0), 0);
    const totalCredit = lines.reduce((s, l) => s + (l.creditAmount || 0), 0);
    return { totalDebit, totalCredit, diff: Math.round((totalDebit - totalCredit) * 100) / 100 };
  }, [lines]);

  async function onFiles(fileList: FileList | null) {
    if (!fileList) return;
    setAttachError(null);
    for (const f of Array.from(fileList)) {
      if (f.size > MAX_FILE) { setAttachError(`"${f.name}" is too large (max 3 MB).`); continue; }
      const data = await new Promise<string>((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(r.result as string); r.onerror = reject; r.readAsDataURL(f); });
      setAttachments((prev) => [...prev, { fileName: f.name, contentType: f.type, sizeBytes: f.size, data }]);
    }
  }

  async function post(print: boolean) {
    setSaving(true); setError(null); setSuccess(null);
    const payload = {
      companyId, locationId: locationId || null, documentNo, postingDate, particulars,
      lines: lines.map((l) => ({
        accountId: l.accountId, debitAmount: l.debitAmount || 0, creditAmount: l.creditAmount || 0, description: l.description || null, referenceNo: l.referenceNo || null,
        counterpartyType: l.showParty ? l.counterpartyType : null, counterpartyId: l.showParty ? l.counterpartyId : null,
        vatType: l.showVatInfo ? l.vatType : null, grossAmount: l.showVatInfo ? l.vatComputed?.grossAmount ?? null : null,
        netAmount: l.showVatInfo ? l.vatComputed?.netAmount ?? null : null, vatAmount: l.showVatInfo ? l.vatComputed?.vatAmount ?? null : null,
        atcCodeId: l.showVatInfo ? l.atcCodeId : null,
      })),
      attachments,
    };
    const res = await fetch("/api/ledger-entries/general-journal", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    setSaving(false);
    if (!res.ok) { const data = await res.json().catch(() => ({})); setError(data.error ?? "Something went wrong posting this entry."); return; }
    const postedDocNo = documentNo;
    setSuccess(`Posted JV ${postedDocNo}.`);
    if (print) window.open(`/transactions/voucher/GENERAL_JOURNAL/${encodeURIComponent(postedDocNo)}?_embed=1`, "_blank");
    const nextRes = await fetch(`/api/ledger-entries/next-document-no?companyId=${companyId}&journalType=GENERAL_JOURNAL`);
    const nextData = await nextRes.json();
    setDocumentNo(nextData.documentNo);
    setParticulars(""); setLines([newLine(), newLine()]); setAttachments([]); setAttachError(null);
  }
  function handleSubmit(e: React.FormEvent) { e.preventDefault(); post(false); }

  const field = "mt-1 w-full rounded border border-neutral-300 px-2 py-1.5 text-sm";
  const label = "block text-xs text-neutral-500";
  const cell = "border-b border-neutral-100 px-2 py-1";

  return (
    <main className="mx-auto max-w-5xl p-4 sm:p-8">
      <div className="flex items-start justify-between gap-3">
        <h1 className="text-xl font-medium text-neutral-900">General journal</h1>
        <a href="/transactions/general-journal/import" className="shrink-0 rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50">Import from Excel</a>
      </div>
      <p className="mt-1 text-sm text-neutral-500">Anything not covered by the other journals. Pick both sides yourself; use a line&apos;s details (⋯) to attach a party or tag VAT for BIR reports.</p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-6">
        <div className="grid grid-cols-1 gap-3 rounded-lg border border-neutral-200 p-4 sm:grid-cols-3">
          <label className={label}>Date<input type="date" required value={postingDate} onChange={(e) => setPostingDate(e.target.value)} className={field} /></label>
          <label className={label}>JV no.<input required value={documentNo} onChange={(e) => setDocumentNo(e.target.value)} className={`${field} font-mono`} /></label>
          <label className={label}>Branch<select value={locationId} onChange={(e) => setLocationId(e.target.value)} className={field}><option value="">—</option>{locations.map((l) => <option key={l.id} value={l.id}>{branchOptionLabel(l)}</option>)}</select></label>
          <label className="block text-xs text-neutral-500 sm:col-span-3">Particulars<input value={particulars} onChange={(e) => setParticulars(e.target.value)} className={field} /></label>

          <div className="sm:col-span-3">
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
            <table className="w-full min-w-[760px] text-xs">
              <thead>
                <tr className="bg-neutral-50 text-left text-neutral-500">
                  <th className={cell}>Account</th><th className={`${cell} text-right`}>Debit</th><th className={`${cell} text-right`}>Credit</th><th className={cell}>Line description</th><th className={cell}>Ref No.</th><th className={cell}>Details</th>
                  <th className={`${cell} text-right`}><button type="button" onClick={clearLines} className="font-medium text-red-600 hover:underline">Clear</button></th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => (
                  <Fragment key={line.key}>
                    <tr>
                      <td className={cell}><select required value={line.accountId} onChange={(e) => updateLine(line.key, { accountId: e.target.value })} className="w-48 rounded border border-neutral-300 px-1 py-1"><option value="">Select…</option>{accounts.map((a) => <option key={a.id} value={a.id}>{a.code} — {a.title}</option>)}</select></td>
                      <td className={cell}><input type="number" step="0.01" value={line.debitAmount || ""} onChange={(e) => updateLine(line.key, { debitAmount: Number(e.target.value), creditAmount: 0 })} className="w-24 rounded border border-neutral-300 px-1 py-1 text-right" /></td>
                      <td className={cell}><input type="number" step="0.01" value={line.creditAmount || ""} onChange={(e) => updateLine(line.key, { creditAmount: Number(e.target.value), debitAmount: 0 })} className="w-24 rounded border border-neutral-300 px-1 py-1 text-right" /></td>
                      <td className={cell}><input value={line.description} onChange={(e) => updateLine(line.key, { description: e.target.value })} className="w-40 rounded border border-neutral-300 px-1 py-1" /></td>
                      <td className={cell}><input value={line.referenceNo} onChange={(e) => updateLine(line.key, { referenceNo: e.target.value })} className="w-28 rounded border border-neutral-300 px-1 py-1" /></td>
                      <td className={cell}><button type="button" onClick={() => updateLine(line.key, { expanded: !line.expanded })} className="rounded border border-neutral-300 px-2 py-0.5 text-neutral-600 hover:bg-neutral-50">{line.expanded ? "Hide" : "⋯"}{(line.showParty || line.showVatInfo) && !line.expanded ? " •" : ""}</button></td>
                      <td className={cell}>{lines.length > 2 && <button type="button" onClick={() => removeLine(line.key)} className="text-red-500 hover:text-red-700">✕</button>}</td>
                    </tr>
                    {line.expanded && (
                      <tr>
                        <td className="border-b border-neutral-100 bg-neutral-50/60 px-3 py-3" colSpan={7}>
                          <div className="flex gap-4 text-xs">
                            <button type="button" onClick={() => updateLine(line.key, { showParty: !line.showParty })} className="text-neutral-600 hover:text-neutral-900">{line.showParty ? "− remove party" : "+ attach party"}</button>
                            <button type="button" onClick={() => updateLine(line.key, { showVatInfo: !line.showVatInfo })} className="text-neutral-600 hover:text-neutral-900">{line.showVatInfo ? "− remove VAT info" : "+ VAT info (for BIR reports)"}</button>
                          </div>
                          {line.showParty && (
                            <div className="mt-3">
                              <CounterpartyPicker counterpartyType={line.counterpartyType} counterpartyId={line.counterpartyId} onTypeChange={(t) => updateLine(line.key, { counterpartyType: t })} onIdChange={(id) => updateLine(line.key, { counterpartyId: id })} vendors={vendorList} employees={employeeList} contacts={contactList} customers={customerList} companyId={companyId} onCreated={(type, record) => { appendParty(type, record); updateLine(line.key, { counterpartyId: record.id, counterpartyType: type }); }} />
                            </div>
                          )}
                          {line.showVatInfo && (
                            <div className="mt-3 space-y-2">
                              <VatComputationFields vatType={line.vatType} onVatTypeChange={(v) => updateLine(line.key, { vatType: v })} amount={line.vatInputAmount} onAmountChange={(v) => updateLine(line.key, { vatInputAmount: v })} amountIsGross={line.amountIsGross} onAmountIsGrossChange={(v) => updateLine(line.key, { amountIsGross: v })} atcCodes={atcCodes} atcCodeId={line.atcCodeId} onAtcCodeChange={(id) => updateLine(line.key, { atcCodeId: id })} onChange={(computed) => updateLine(line.key, { vatComputed: computed })} />
                              {line.vatComputed && (
                                <div className="flex flex-wrap gap-2">
                                  <button type="button" onClick={() => updateLine(line.key, { debitAmount: line.vatComputed!.netAmount, creditAmount: 0 })} className="rounded border border-neutral-300 px-2 py-1 text-xs hover:bg-neutral-50">Use net ({formatPeso(line.vatComputed.netAmount)}) → Debit</button>
                                  <button type="button" onClick={() => updateLine(line.key, { creditAmount: line.vatComputed!.netAmount, debitAmount: 0 })} className="rounded border border-neutral-300 px-2 py-1 text-xs hover:bg-neutral-50">Use net → Credit</button>
                                  {line.vatComputed.vatAmount > 0 && (
                                    <>
                                      <button type="button" onClick={() => updateLine(line.key, { debitAmount: line.vatComputed!.vatAmount, creditAmount: 0 })} className="rounded border border-neutral-300 px-2 py-1 text-xs hover:bg-neutral-50">Use VAT ({formatPeso(line.vatComputed.vatAmount)}) → Debit</button>
                                      <button type="button" onClick={() => updateLine(line.key, { creditAmount: line.vatComputed!.vatAmount, debitAmount: 0 })} className="rounded border border-neutral-300 px-2 py-1 text-xs hover:bg-neutral-50">Use VAT → Credit</button>
                                    </>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-neutral-50 font-medium"><td className={cell}>Totals</td><td className={`${cell} text-right font-mono`}>{formatPeso(totals.totalDebit)}</td><td className={`${cell} text-right font-mono`}>{formatPeso(totals.totalCredit)}</td><td className={cell} colSpan={4}></td></tr>
              </tfoot>
            </table>
          </div>
          <button type="button" onClick={addLine} className="mt-2 text-xs text-brand-blue hover:underline">+ Add line</button>
        </div>

        <div className="grid grid-cols-1 gap-3 rounded-lg bg-neutral-50 p-4 text-sm sm:grid-cols-3">
          <div><div className="text-xs text-neutral-400">Total debit</div><div className="font-mono">{formatPeso(totals.totalDebit)}</div></div>
          <div><div className="text-xs text-neutral-400">Total credit</div><div className="font-mono">{formatPeso(totals.totalCredit)}</div></div>
          <div><div className="text-xs text-neutral-400">Difference</div><div className={`font-mono font-medium ${totals.diff !== 0 ? "text-red-600" : "text-green-600"}`}>{formatPeso(totals.diff)}</div></div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        {success && <p className="text-sm text-green-600">{success}</p>}

        <div className="flex gap-2">
          <button type="submit" disabled={saving || totals.diff !== 0} className="rounded bg-[#0B2A5E] px-4 py-2 text-sm text-white hover:bg-[#123A73] disabled:opacity-50">{saving ? "Posting…" : "Save & new"}</button>
          <button type="button" onClick={() => post(true)} disabled={saving || totals.diff !== 0} className="rounded border border-brand-blue px-4 py-2 text-sm font-medium text-brand-blue hover:bg-blue-50 disabled:opacity-50">Save &amp; Print</button>
        </div>
      </form>
    </main>
  );
}
