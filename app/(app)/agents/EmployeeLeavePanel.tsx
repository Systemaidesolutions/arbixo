"use client";

import { useEffect, useState } from "react";

type Data = {
  hasProfile: boolean;
  leaveMonthlyAccrual: boolean | null;
  companyMonthly: boolean;
  year: number;
  balances: { leaveTypeId: string; code: string; name: string; earned: number; used: number; left: number }[];
  portalEnabled: boolean;
  pin: { hasPin: boolean; setAt: string | null; locked: boolean };
};

// Employee-level leave settings on the shared Employees edit form. Shown only
// to users with ARbixo Payroll in this company (the API answers 403 otherwise,
// and the panel hides itself).
export function EmployeeLeavePanel({ employeeId, employeeName, employeeCode }: { employeeId: string; employeeName: string; employeeCode: string }) {
  const [data, setData] = useState<Data | null>(null);
  const [hidden, setHidden] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [newPin, setNewPin] = useState<string | null>(null);
  const [typing, setTyping] = useState(false);
  const [pin, setPin] = useState("");

  async function load() {
    const res = await fetch(`/api/payroll/employee-leave/${employeeId}`).catch(() => null);
    if (!res || res.status === 403 || res.status === 401) return setHidden(true);
    if (!res.ok) return setMsg({ ok: false, text: "Couldn't load leave settings." });
    setData(await res.json());
  }

  useEffect(() => {
    setData(null);
    setHidden(false);
    setMsg(null);
    setNewPin(null);
    setTyping(false);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeId]);

  async function send(url: string, method: string, body: object) {
    setBusy(true);
    setMsg(null);
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
    setBusy(false);
    const j = res ? await res.json().catch(() => ({})) : {};
    if (!res?.ok) {
      setMsg({ ok: false, text: j.error ?? "Something went wrong." });
      return null;
    }
    return j;
  }

  async function setAccrual(v: string) {
    const value = v === "" ? null : v === "MONTHLY";
    if (await send(`/api/payroll/employee-leave/${employeeId}`, "PATCH", { leaveMonthlyAccrual: value })) {
      setMsg({ ok: true, text: "Saved." });
      load();
    }
  }

  async function pinAction(body: { generate?: boolean; pin?: string; remove?: boolean }) {
    if (body.remove && !confirm(`Remove ${employeeName}'s PIN? They won't be able to use the leave portal until you set a new one.`)) return;
    const j = await send("/api/payroll/leave-portal/pin", "POST", { employeeId, ...body });
    if (!j) return;
    setTyping(false);
    setPin("");
    setNewPin(j.pin ?? null);
    if (!j.pin) setMsg({ ok: true, text: body.remove ? "PIN removed." : "PIN saved." });
    load();
  }

  if (hidden) return null;

  const btn = "rounded border px-2 py-1 text-xs font-medium disabled:opacity-40";

  return (
    <section className="mt-4 space-y-3 border-t border-neutral-200 pt-4">
      <h3 className="text-sm font-medium text-neutral-900">Leave</h3>
      {!data ? (
        <p className="text-xs text-neutral-400">{msg ? msg.text : "Loading…"}</p>
      ) : (
        <>
          {!data.hasProfile ? (
            <p className="rounded border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs text-amber-900">
              No payroll details yet, so leave credits don&apos;t apply.{" "}
              <a href="/payroll/employees" className="font-medium underline">Set up in Payroll employees</a>.
            </p>
          ) : (
            <>
              <label className="block text-xs text-neutral-500">
                Leave credits are earned
                <select
                  value={data.leaveMonthlyAccrual == null ? "" : data.leaveMonthlyAccrual ? "MONTHLY" : "UPFRONT"}
                  onChange={(e) => setAccrual(e.target.value)}
                  disabled={busy}
                  className="mt-1 w-full rounded border border-neutral-300 px-2 py-1.5 text-sm text-neutral-900"
                >
                  <option value="">Company setting ({data.companyMonthly ? "monthly" : "all on Jan 1"})</option>
                  <option value="MONTHLY">Monthly</option>
                  <option value="UPFRONT">All on Jan 1</option>
                </select>
              </label>

              <div>
                <div className="flex items-center justify-between text-xs text-neutral-500">
                  <span>Credits {data.year}</span>
                  <a href={`/payroll/leaves?tab=balances&year=${data.year}`} className="text-brand-blue hover:underline">Adjust credits</a>
                </div>
                {data.balances.length === 0 ? (
                  <p className="mt-1 text-xs text-neutral-400">
                    No {data.year} credits yet. Grant them in Leave › Balances.
                  </p>
                ) : (
                  <table className="mt-1 w-full text-xs">
                    <thead className="text-neutral-500">
                      <tr>
                        <th className="py-0.5 text-left font-medium">Type</th>
                        <th className="py-0.5 text-right font-medium">Earned</th>
                        <th className="py-0.5 text-right font-medium">Used</th>
                        <th className="py-0.5 text-right font-medium">Left</th>
                      </tr>
                    </thead>
                    <tbody className="text-neutral-800">
                      {data.balances.map((b) => (
                        <tr key={b.leaveTypeId} className="border-t border-neutral-100">
                          <td className="py-0.5" title={b.name}>{b.code}</td>
                          <td className="py-0.5 text-right">{b.earned}</td>
                          <td className="py-0.5 text-right">{b.used}</td>
                          <td className="py-0.5 text-right font-medium">{b.left}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </>
          )}

          <div>
            <div className="flex items-center justify-between text-xs text-neutral-500">
              <span>Leave portal PIN</span>
              <a href="/payroll/leave-portal" className="text-brand-blue hover:underline">Portal link</a>
            </div>
            <p className="mt-1 text-xs">
              {data.pin.locked ? (
                <span className="text-red-700">Locked after wrong PINs. Reset the PIN to unlock.</span>
              ) : data.pin.hasPin ? (
                <span className="text-green-700">
                  Set{data.pin.setAt ? ` ${new Date(data.pin.setAt).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}` : ""}
                </span>
              ) : (
                <span className="text-neutral-400">Not set: can&apos;t use the leave portal yet.</span>
              )}
              {!data.portalEnabled && <span className="ml-1 text-amber-700">(Portal is off for the company.)</span>}
            </p>
            {newPin && (
              <div className="mt-2 rounded border border-green-300 bg-green-50 px-2 py-1.5 text-xs text-green-900">
                New PIN for employee no. <b>{employeeCode}</b>: <span className="font-mono text-base tracking-[0.3em]">{newPin}</span>
                <div>Give this to the employee now. It won&apos;t be shown again.</div>
              </div>
            )}
            {typing ? (
              <div className="mt-2 flex items-center gap-1">
                <input
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="4–6 digits"
                  inputMode="numeric"
                  autoFocus
                  className="w-24 rounded border border-neutral-300 px-2 py-1 text-xs tracking-widest"
                />
                <button type="button" onClick={() => pinAction({ pin })} disabled={busy || pin.length < 4} className={`${btn} border-brand-navy bg-brand-navy text-white`}>
                  Save
                </button>
                <button type="button" onClick={() => setTyping(false)} className={`${btn} border-neutral-300 text-neutral-600`}>
                  Cancel
                </button>
              </div>
            ) : (
              <div className="mt-2 flex flex-wrap gap-1">
                <button type="button" onClick={() => pinAction({ generate: true })} disabled={busy} className={`${btn} border-blue-300 text-blue-700 hover:bg-blue-50`}>
                  {data.pin.hasPin ? "Reset PIN" : "Generate PIN"}
                </button>
                <button type="button" onClick={() => { setTyping(true); setPin(""); }} disabled={busy} className={`${btn} border-neutral-300 text-neutral-700 hover:bg-neutral-50`}>
                  Type PIN
                </button>
                {data.pin.hasPin && (
                  <button type="button" onClick={() => pinAction({ remove: true })} disabled={busy} className={`${btn} border-red-200 text-red-600 hover:bg-red-50`}>
                    Remove
                  </button>
                )}
              </div>
            )}
          </div>
          {msg && <p className={`text-xs ${msg.ok ? "text-green-600" : "text-red-600"}`}>{msg.text}</p>}
        </>
      )}
    </section>
  );
}
