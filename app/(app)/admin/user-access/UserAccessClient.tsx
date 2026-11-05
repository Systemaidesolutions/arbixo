"use client";

import { useMemo, useState } from "react";
import { PERMISSIONS, PERMISSION_KEYS, type PermissionKey } from "@/lib/userPermissions";

export type AccessRow = {
  id: string; email: string; name: string | null; type: string; company: string; isDisabled: boolean; denied: PermissionKey[];
};

export function UserAccessClient({ rows: initial }: { rows: AccessRow[] }) {
  const [rows, setRows] = useState(initial);
  const [q, setQ] = useState("");
  const [company, setCompany] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const companies = useMemo(() => [...new Set(initial.map((r) => r.company))].sort(), [initial]);
  const shown = rows.filter(
    (r) =>
      (!company || r.company === company) &&
      (!q || `${r.email} ${r.name ?? ""} ${r.company}`.toLowerCase().includes(q.toLowerCase()))
  );

  async function save(row: AccessRow, denied: PermissionKey[]) {
    setBusy(row.id);
    setMsg(null);
    const prev = row.denied;
    setRows((rs) => rs.map((r) => (r.id === row.id ? { ...r, denied } : r)));
    const res = await fetch(`/api/admin/users/${row.id}/access`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ denied }),
    });
    setBusy(null);
    if (!res.ok) {
      setRows((rs) => rs.map((r) => (r.id === row.id ? { ...r, denied: prev } : r)));
      const j = await res.json().catch(() => ({}));
      return setMsg({ ok: false, text: j.error ?? "Could not save." });
    }
    setMsg({ ok: true, text: `Saved access for ${row.email}.` });
  }

  const toggle = (row: AccessRow, key: PermissionKey) =>
    save(
      row,
      row.denied.includes(key) ? row.denied.filter((k) => k !== key) : PERMISSION_KEYS.filter((k) => k === key || row.denied.includes(k))
    );

  const field = "rounded border border-neutral-300 px-2 py-1.5 text-sm";

  return (
    <div className="mt-6">
      <div className="flex flex-wrap items-center gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search email, name or company" className={`${field} w-64 max-w-full`} />
        <select value={company} onChange={(e) => setCompany(e.target.value)} className={field}>
          <option value="">All companies</option>
          {companies.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <span className="text-xs text-neutral-500">{shown.length} user(s)</span>
        {msg && <span className={`text-xs ${msg.ok ? "text-green-600" : "text-red-600"}`}>{msg.text}</span>}
      </div>

      <div className="mt-3 overflow-x-auto rounded-lg border border-neutral-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-left text-xs text-neutral-600">
            <tr>
              <th className="sticky left-0 z-10 bg-neutral-50 px-3 py-2 font-medium">User</th>
              {PERMISSIONS.map((p) => (
                <th key={p.key} title={p.description} className="w-24 px-2 py-2 text-center align-bottom font-medium leading-tight">
                  {p.label.replace(/^Can /, "")}
                </th>
              ))}
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {shown.length === 0 && (
              <tr>
                <td colSpan={PERMISSIONS.length + 2} className="px-3 py-4 text-neutral-400">No users match.</td>
              </tr>
            )}
            {shown.map((r) => (
              <tr key={r.id} className={r.isDisabled ? "opacity-50" : ""}>
                <td className="sticky left-0 z-10 bg-white px-3 py-2">
                  <div className="font-medium text-neutral-800">{r.email}</div>
                  <div className="text-xs text-neutral-500">
                    {r.company} · {r.type}
                    {r.isDisabled ? " · disabled" : ""}
                    {r.denied.length === 0 ? (
                      <span className="ml-1 text-green-700">· full access</span>
                    ) : (
                      <span className="ml-1 text-amber-700">· {r.denied.length} removed</span>
                    )}
                  </div>
                </td>
                {PERMISSIONS.map((p) => (
                  <td key={p.key} className="px-2 py-2 text-center">
                    <input
                      type="checkbox"
                      aria-label={`${p.label} for ${r.email}`}
                      checked={!r.denied.includes(p.key)}
                      disabled={busy === r.id}
                      onChange={() => toggle(r, p.key)}
                      className="h-4 w-4 accent-green-600"
                    />
                  </td>
                ))}
                <td className="whitespace-nowrap px-3 py-2 text-right">
                  {r.denied.length > 0 && (
                    <button onClick={() => save(r, [])} disabled={busy === r.id} className="text-xs text-brand-blue hover:underline disabled:opacity-50">
                      Grant all
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <dl className="mt-6 grid gap-x-6 gap-y-2 text-xs sm:grid-cols-2">
        {PERMISSIONS.map((p) => (
          <div key={p.key}>
            <dt className="font-medium text-neutral-700">{p.label}</dt>
            <dd className="text-neutral-500">{p.description}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
