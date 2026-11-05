"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Emp = {
  id: string; code: string; name: string; contact: string; hasPin: boolean; pinSetAt: string | null; locked: boolean; payrollReady: boolean;
};

export function LeavePortalSetupClient({
  canEdit,
  origin,
  enabled: initialEnabled,
  code: initialCode,
  employees,
}: {
  canEdit: boolean;
  origin: string;
  enabled: boolean;
  code: string | null;
  employees: Emp[];
}) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(initialEnabled);
  const [code, setCode] = useState(initialCode);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [shown, setShown] = useState<{ name: string; code: string; pin: string } | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [pin, setPin] = useState("");
  const [q, setQ] = useState("");

  const link = code ? `${origin}/leave/${code}` : "";
  const list = employees.filter((e) => !q || `${e.code} ${e.name}`.toLowerCase().includes(q.toLowerCase()));
  const withPin = employees.filter((e) => e.hasPin).length;

  async function send(url: string, method: string, body: object, key: string) {
    setBusy(key);
    setMsg(null);
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
    setBusy(null);
    const data = res ? await res.json().catch(() => ({})) : {};
    if (!res?.ok) {
      setMsg({ ok: false, text: data.error ?? "Something went wrong." });
      return null;
    }
    return data;
  }

  async function savePortal(body: { enabled?: boolean; newLink?: boolean }) {
    const data = await send("/api/payroll/leave-portal", "PUT", body, "portal");
    if (!data) return;
    setEnabled(data.leavePortalEnabled);
    setCode(data.leavePortalCode);
    setMsg({
      ok: true,
      text: body.newLink ? "New link created. The old link no longer works; share the new one." : data.leavePortalEnabled ? "Leave portal is on." : "Leave portal is off.",
    });
  }

  async function setEmpPin(e: Emp, body: { pin?: string; generate?: boolean; remove?: boolean }) {
    if (body.remove && !confirm(`Remove ${e.name}'s PIN? They won't be able to sign in until you set a new one.`)) return;
    const data = await send("/api/payroll/leave-portal/pin", "POST", { employeeId: e.id, ...body }, e.id);
    if (!data) return;
    setEditing(null);
    setPin("");
    if (data.pin) setShown({ name: e.name, code: e.code, pin: data.pin });
    else setMsg({ ok: true, text: body.remove ? `PIN removed for ${e.name}.` : `PIN saved for ${e.name}.` });
    router.refresh();
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setMsg({ ok: true, text: "Copied." });
    } catch {
      setMsg({ ok: false, text: "Couldn't copy. Select the text and copy it instead." });
    }
  }

  const btn = "rounded border px-2 py-1 text-xs font-medium disabled:opacity-40";

  return (
    <div className="mt-6 space-y-6">
      <section className="rounded-lg border border-neutral-200 bg-white p-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-sm font-medium text-neutral-800">Leave portal link</div>
            <div className="text-xs text-neutral-500">
              {enabled ? "On: employees with a PIN can sign in and file leave." : "Off: the link shows “not active”."}
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            aria-label="Leave portal on or off"
            disabled={!canEdit || busy === "portal"}
            onClick={() => savePortal({ enabled: !enabled })}
            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
              enabled ? "bg-brand-green" : "bg-neutral-300"
            }`}
          >
            <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${enabled ? "translate-x-5" : "translate-x-0.5"}`} />
          </button>
        </div>
        {link && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <code className="min-w-0 flex-1 break-all rounded bg-neutral-100 px-2 py-1.5 text-xs text-neutral-800">{link}</code>
            <button onClick={() => copy(link)} className={`${btn} border-neutral-300 text-neutral-700 hover:bg-neutral-50`}>
              Copy link
            </button>
            {canEdit && (
              <button
                onClick={() => confirm("Create a new link? The current link will stop working.") && savePortal({ newLink: true })}
                disabled={busy === "portal"}
                className={`${btn} border-amber-300 text-amber-700 hover:bg-amber-50`}
              >
                New link
              </button>
            )}
          </div>
        )}
        <p className="mt-2 text-[11px] text-neutral-400">
          Share the link in your company group chat or by text. On its own it&apos;s not enough to sign in: each employee also
          needs their PIN.
        </p>
      </section>

      {shown && (
        <section className="rounded-lg border border-green-300 bg-green-50 p-4 text-sm text-green-900">
          <div className="flex items-start justify-between gap-3">
            <div>
              New PIN for <b>{shown.name}</b> (employee no. <b>{shown.code}</b>):
              <div className="mt-1 font-mono text-2xl tracking-[0.3em]">{shown.pin}</div>
              <div className="mt-1 text-xs">Give this to the employee now. It won&apos;t be shown again.</div>
            </div>
            <button onClick={() => setShown(null)} className="text-xs text-green-800 hover:underline">
              Done
            </button>
          </div>
        </section>
      )}

      <section>
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search employee"
            className="w-64 max-w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
          />
          <span className="text-xs text-neutral-500">
            {withPin} of {employees.length} active employees have a PIN
          </span>
          {msg && <span className={`text-xs ${msg.ok ? "text-green-600" : "text-red-600"}`}>{msg.text}</span>}
        </div>
        <div className="mt-3 overflow-x-auto rounded-lg border border-neutral-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-left text-xs text-neutral-600">
              <tr>
                <th className="px-3 py-2 font-medium">Employee no.</th>
                <th className="px-3 py-2 font-medium">Name</th>
                <th className="px-3 py-2 font-medium">PIN</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {list.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-4 text-neutral-400">No employees match.</td>
                </tr>
              )}
              {list.map((e) => (
                <tr key={e.id}>
                  <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-neutral-700">{e.code}</td>
                  <td className="px-3 py-2">
                    <div className="text-neutral-800">{e.name}</div>
                    {!e.payrollReady && <div className="text-[11px] text-amber-700">No payroll details yet: can sign in but can&apos;t file.</div>}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-xs">
                    {e.locked ? (
                      <span className="rounded-full bg-red-100 px-2 py-0.5 font-medium text-red-700">Locked (wrong PINs)</span>
                    ) : e.hasPin ? (
                      <span className="text-green-700">
                        Set{e.pinSetAt ? ` ${new Date(e.pinSetAt).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}` : ""}
                      </span>
                    ) : (
                      <span className="text-neutral-400">Not set</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right">
                    {canEdit &&
                      (editing === e.id ? (
                        <span className="inline-flex items-center gap-1">
                          <input
                            value={pin}
                            onChange={(ev) => setPin(ev.target.value.replace(/\D/g, "").slice(0, 6))}
                            placeholder="4–6 digits"
                            inputMode="numeric"
                            autoFocus
                            className="w-24 rounded border border-neutral-300 px-2 py-1 text-xs tracking-widest"
                          />
                          <button
                            onClick={() => setEmpPin(e, { pin })}
                            disabled={busy === e.id || pin.length < 4}
                            className={`${btn} border-brand-navy bg-brand-navy text-white`}
                          >
                            Save
                          </button>
                          <button onClick={() => { setEditing(null); setPin(""); }} className={`${btn} border-neutral-300 text-neutral-600`}>
                            Cancel
                          </button>
                        </span>
                      ) : (
                        <span className="inline-flex gap-1">
                          <button
                            onClick={() => setEmpPin(e, { generate: true })}
                            disabled={busy === e.id}
                            className={`${btn} border-blue-300 text-blue-700 hover:bg-blue-50`}
                          >
                            {e.hasPin ? "Reset PIN" : "Generate PIN"}
                          </button>
                          <button
                            onClick={() => { setEditing(e.id); setPin(""); }}
                            disabled={busy === e.id}
                            className={`${btn} border-neutral-300 text-neutral-700 hover:bg-neutral-50`}
                          >
                            Type PIN
                          </button>
                          {e.hasPin && (
                            <button
                              onClick={() => setEmpPin(e, { remove: true })}
                              disabled={busy === e.id}
                              className={`${btn} border-red-200 text-red-600 hover:bg-red-50`}
                            >
                              Remove
                            </button>
                          )}
                        </span>
                      ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-[11px] text-neutral-400">
          Resetting a PIN also unlocks the employee and signs them out of the portal. After 5 wrong PINs an employee is locked for 15 minutes.
        </p>
      </section>
    </div>
  );
}
