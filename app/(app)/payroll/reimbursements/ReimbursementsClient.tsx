"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Row = {
  id: string; employee: string; employeeCode: string; date: string; filedAt: string; category: string; description: string;
  amount: number; status: string; viaPortal: boolean; decisionNote: string | null; paidNote: string | null; paidAt: string | null;
  attachments: { id: string; fileName: string; contentType: string }[];
};
type Summary = Record<"PENDING" | "APPROVED" | "PAID", { count: number; amount: number }>;

const peso = (n: number) => `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmt = (iso: string) => new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString("en-PH", { timeZone: "UTC", month: "short", day: "numeric", year: "numeric" });
const STATUS: Record<string, [string, string]> = {
  PENDING: ["Pending", "bg-amber-100 text-amber-800"],
  APPROVED: ["Approved", "bg-green-100 text-green-800"],
  PAID: ["Paid", "bg-blue-100 text-blue-800"],
  REJECTED: ["Rejected", "bg-red-100 text-red-700"],
  CANCELLED: ["Cancelled", "bg-neutral-200 text-neutral-600"],
};
const TABS: [string, string][] = [["PENDING", "Pending"], ["APPROVED", "Approved (to pay)"], ["PAID", "Paid"], ["ALL", "All"]];

export function ReimbursementsClient({ canEdit, tab, summary, rows }: { canEdit: boolean; tab: string; summary: Summary; rows: Row[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [preview, setPreview] = useState<{ url: string; pdf: boolean } | null>(null);

  async function act(r: Row, action: "approve" | "reject" | "paid" | "cancel") {
    let note: string | null = null;
    if (action === "reject") {
      note = prompt(`Reason for rejecting ${r.employee}'s ${peso(r.amount)} reimbursement (the employee will see this):`);
      if (note === null) return;
    } else if (action === "paid") {
      note = prompt(`Mark ${peso(r.amount)} to ${r.employee} as paid. Reference (optional), e.g. cash, GCash ref, or payroll run:`, "");
      if (note === null) return;
    } else if (action === "cancel") {
      if (!confirm(`Cancel ${r.employee}'s ${peso(r.amount)} reimbursement?`)) return;
    }
    setBusy(r.id);
    setMsg(null);
    const res = await fetch(`/api/payroll/reimbursements/${r.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, note }),
    }).catch(() => null);
    setBusy(null);
    const data = res ? await res.json().catch(() => ({})) : {};
    if (!res?.ok) return setMsg({ ok: false, text: data.error ?? "Something went wrong." });
    const done = { approve: "Approved", reject: "Rejected", paid: "Marked paid", cancel: "Cancelled" }[action];
    setMsg({ ok: true, text: `${done}: ${r.employee}, ${peso(r.amount)}.` });
    router.refresh();
  }

  const btn = "rounded border px-2 py-1 text-xs font-medium disabled:opacity-40";

  return (
    <div className="mt-6">
      <div className="grid gap-3 sm:grid-cols-3">
        {(["PENDING", "APPROVED", "PAID"] as const).map((k) => (
          <div key={k} className="rounded-lg border border-neutral-200 bg-white p-3">
            <div className="text-xs text-neutral-500">{k === "PENDING" ? "Waiting for approval" : k === "APPROVED" ? "Approved, not yet paid" : "Paid"}</div>
            <div className="text-lg font-semibold text-neutral-900">{peso(summary[k].amount)}</div>
            <div className="text-xs text-neutral-500">{summary[k].count} item(s)</div>
          </div>
        ))}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-1 border-b border-neutral-200">
        {TABS.map(([k, label]) => (
          <a
            key={k}
            href={`/payroll/reimbursements?tab=${k}`}
            className={`-mb-px border-b-2 px-3 py-2 text-sm ${tab === k ? "border-brand-navy font-medium text-brand-navy" : "border-transparent text-neutral-500 hover:text-neutral-800"}`}
          >
            {label}
          </a>
        ))}
        {msg && <span className={`ml-auto text-xs ${msg.ok ? "text-green-600" : "text-red-600"}`}>{msg.text}</span>}
      </div>

      <div className="mt-3 overflow-x-auto rounded-lg border border-neutral-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-left text-xs text-neutral-600">
            <tr>
              <th className="px-3 py-2 font-medium">Employee</th>
              <th className="px-3 py-2 font-medium">Expense date</th>
              <th className="px-3 py-2 font-medium">Details</th>
              <th className="px-3 py-2 text-right font-medium">Amount</th>
              <th className="px-3 py-2 font-medium">Receipt</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 align-top">
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-neutral-400">Nothing here.</td>
              </tr>
            )}
            {rows.map((r) => {
              const [st, cls] = STATUS[r.status] ?? [r.status, ""];
              return (
                <tr key={r.id}>
                  <td className="px-3 py-2">
                    <div className="text-neutral-800">{r.employee}</div>
                    <div className="text-[11px] text-neutral-500">
                      {r.employeeCode} · filed {fmt(r.filedAt)}
                      {r.viaPortal && <span className="ml-1 rounded bg-blue-50 px-1 text-blue-700">by employee</span>}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-neutral-700">{fmt(r.date)}</td>
                  <td className="max-w-xs px-3 py-2">
                    <div className="text-xs font-medium text-neutral-700">{r.category}</div>
                    <div className="break-words text-xs text-neutral-600">{r.description}</div>
                    {r.decisionNote && <div className="text-[11px] text-neutral-400">Note: {r.decisionNote}</div>}
                    {r.status === "PAID" && (
                      <div className="text-[11px] text-neutral-400">
                        Paid {r.paidAt ? fmt(r.paidAt) : ""}{r.paidNote ? ` · ${r.paidNote}` : ""}
                      </div>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right font-medium text-neutral-900">{peso(r.amount)}</td>
                  <td className="px-3 py-2">
                    <div className="flex gap-1">
                      {r.attachments.map((a) => {
                        const url = `/api/payroll/reimbursements/attachments/${a.id}`;
                        const pdf = a.contentType === "application/pdf";
                        return (
                          <button key={a.id} type="button" onClick={() => setPreview({ url, pdf })} title={a.fileName} className="shrink-0">
                            {pdf ? (
                              <span className="flex h-10 w-10 items-center justify-center rounded border border-neutral-200 bg-neutral-50 text-[10px] text-neutral-600">PDF</span>
                            ) : (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={url} alt={a.fileName} className="h-10 w-10 rounded border border-neutral-200 object-cover" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${cls}`}>{st}</span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right">
                    {canEdit && (
                      <span className="inline-flex gap-1">
                        {r.status === "PENDING" && (
                          <>
                            <button onClick={() => act(r, "approve")} disabled={busy === r.id} className={`${btn} border-green-300 text-green-700 hover:bg-green-50`}>
                              Approve
                            </button>
                            <button onClick={() => act(r, "reject")} disabled={busy === r.id} className={`${btn} border-red-200 text-red-600 hover:bg-red-50`}>
                              Reject
                            </button>
                          </>
                        )}
                        {r.status === "APPROVED" && (
                          <>
                            <button onClick={() => act(r, "paid")} disabled={busy === r.id} className={`${btn} border-blue-300 text-blue-700 hover:bg-blue-50`}>
                              Mark paid
                            </button>
                            <button onClick={() => act(r, "cancel")} disabled={busy === r.id} className={`${btn} border-neutral-300 text-neutral-600 hover:bg-neutral-50`}>
                              Cancel
                            </button>
                          </>
                        )}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setPreview(null)}>
          <div className="relative max-h-full w-full max-w-3xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 flex justify-end gap-2">
              <a href={preview.url} target="_blank" rel="noreferrer" className="rounded bg-white px-3 py-1 text-xs text-neutral-800">
                Open in new tab
              </a>
              <button onClick={() => setPreview(null)} className="rounded bg-white px-3 py-1 text-xs text-neutral-800">
                Close
              </button>
            </div>
            {preview.pdf ? (
              <iframe src={preview.url} title="Receipt" className="h-[80vh] w-full rounded bg-white" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview.url} alt="Receipt" className="mx-auto max-h-[80vh] rounded bg-white object-contain" />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
