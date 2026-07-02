"use client";

import { useState } from "react";
import type { AuditRow } from "@/lib/audit";

type CompanyOption = { id: string; tradeName: string };

export function AuditTrailClient({
  isAdmin,
  companies,
  initialRows,
}: {
  isAdmin: boolean;
  companies: CompanyOption[];
  initialRows: AuditRow[];
}) {
  const [rows, setRows] = useState<AuditRow[]>(initialRows);
  const [company, setCompany] = useState<string>("");
  const [loading, setLoading] = useState(false);

  async function onFilter(value: string) {
    setCompany(value);
    setLoading(true);
    const url = value ? `/api/utility/audit-trail?company=${value}` : "/api/utility/audit-trail";
    const res = await fetch(url);
    const data = await res.json().catch(() => ({ rows: [] }));
    setRows(data.rows ?? []);
    setLoading(false);
  }

  return (
    <div className="mt-6">
      {isAdmin && (
        <div className="mb-3">
          <label className="text-xs text-neutral-500">
            Company
            <select
              value={company}
              onChange={(e) => onFilter(e.target.value)}
              className="ml-2 rounded border border-neutral-300 px-2 py-1 text-sm"
            >
              <option value="">All companies</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.tradeName}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-neutral-200">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
            <tr>
              <th className="px-3 py-2 text-left">When</th>
              {isAdmin && <th className="px-3 py-2 text-left">Company</th>}
              <th className="px-3 py-2 text-left">User</th>
              <th className="px-3 py-2 text-left">Action</th>
              <th className="px-3 py-2 text-left">IP</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {loading ? (
              <tr>
                <td colSpan={isAdmin ? 5 : 4} className="px-3 py-6 text-center text-neutral-400">
                  Loading…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={isAdmin ? 5 : 4} className="px-3 py-6 text-center text-neutral-400">
                  No activity recorded yet.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id}>
                  <td className="px-3 py-2 text-neutral-500">
                    {new Date(r.createdAt).toISOString().replace("T", " ").slice(0, 19)}
                  </td>
                  {isAdmin && <td className="px-3 py-2 text-neutral-600">{r.companyName ?? "—"}</td>}
                  <td className="px-3 py-2 text-neutral-700">{r.username}</td>
                  <td className="px-3 py-2 text-neutral-700">{r.action}</td>
                  <td className="px-3 py-2 font-mono text-xs text-neutral-400">{r.ipAddress ?? "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
