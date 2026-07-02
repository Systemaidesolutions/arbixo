"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { SubscriberSubtype } from "@prisma/client";
import { SUBTYPE_LABELS } from "@/lib/permissions";

export type AdminUserRow = {
  id: string;
  email: string;
  role: "ADMIN" | "USER";
  subscriberSubtype: SubscriberSubtype | null;
  companyId: string | null;
  companyName: string | null;
  isVerified: boolean;
  isDisabled: boolean;
  createdAt: string;
  transactionCount: number;
  isSelf: boolean;
};

export function AdminUsersTable({ users }: { users: AdminUserRow[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resetLink, setResetLink] = useState<{ email: string; url: string } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function act(id: string, run: () => Promise<Response>) {
    setBusyId(id);
    setError(null);
    setNotice(null);
    try {
      const res = await run();
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Action failed.");
        return null;
      }
      router.refresh();
      return data;
    } finally {
      setBusyId(null);
    }
  }

  function patch(id: string, body: Record<string, unknown>) {
    return act(id, () =>
      fetch(`/api/admin/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
    );
  }

  async function del(id: string, email: string) {
    if (!confirm(`Delete ${email}? This can't be undone.`)) return;
    await act(id, () => fetch(`/api/admin/users/${id}`, { method: "DELETE" }));
  }

  async function resetPassword(id: string, email: string) {
    const data = await act(id, () =>
      fetch(`/api/admin/users/${id}/reset-password`, { method: "POST" })
    );
    if (!data) return;
    if (data.emailed) {
      setNotice(`A password reset link was emailed to ${email}.`);
    } else if (data.resetUrl) {
      // Email isn't configured yet — show the link so the admin can relay it.
      setResetLink({ email, url: data.resetUrl });
    }
  }

  const btn =
    "rounded border px-2 py-1 text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed";

  return (
    <div className="mt-6">
      {error && (
        <div className="mb-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}
      {notice && (
        <div className="mb-3 rounded border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
          {notice}
        </div>
      )}
      {resetLink && (
        <div className="mb-3 rounded border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800">
          <p className="font-medium">Reset link for {resetLink.email}</p>
          <p className="mt-1 text-xs text-blue-700">
            Email isn't configured, so copy this link and give it to the user (expires in 1 hour):
          </p>
          <code className="mt-1 block overflow-x-auto rounded bg-white px-2 py-1 text-xs text-neutral-700">
            {resetLink.url}
          </code>
          <button
            onClick={() => navigator.clipboard?.writeText(resetLink.url)}
            className="mt-2 rounded border border-blue-300 bg-white px-2 py-1 text-xs text-blue-700 hover:bg-blue-100"
          >
            Copy link
          </button>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-neutral-200">
        <table className="w-full min-w-[820px] text-sm">
          <thead className="bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
            <tr>
              <th className="px-3 py-2 text-left">Email</th>
              <th className="px-3 py-2 text-left">Type</th>
              <th className="px-3 py-2 text-left">Subtype</th>
              <th className="px-3 py-2 text-left">Company</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-left">Txns</th>
              <th className="px-3 py-2 text-left">Joined</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {users.map((u) => {
              const busy = busyId === u.id;
              return (
                <tr key={u.id} className={u.isDisabled ? "bg-neutral-50/60" : undefined}>
                  <td className="px-3 py-2">
                    {u.email}
                    {u.isSelf && <span className="ml-1 text-xs text-neutral-400">(you)</span>}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`rounded px-1.5 py-0.5 text-xs ${
                        u.role === "ADMIN"
                          ? "bg-brand-navy/10 text-brand-navy"
                          : "bg-neutral-100 text-neutral-600"
                      }`}
                    >
                      {u.role === "ADMIN" ? "Arbixo admin" : "Subscriber"}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-neutral-600">
                    {u.role === "ADMIN" || !u.subscriberSubtype ? (
                      <span className="text-neutral-400">—</span>
                    ) : (
                      SUBTYPE_LABELS[u.subscriberSubtype]
                    )}
                  </td>
                  <td className="px-3 py-2 text-neutral-500">{u.companyName ?? "—"}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      {u.isDisabled ? (
                        <span className="rounded bg-red-100 px-1.5 py-0.5 text-xs text-red-700">
                          Disabled
                        </span>
                      ) : u.isVerified ? (
                        <span className="rounded bg-green-100 px-1.5 py-0.5 text-xs text-green-700">
                          Active
                        </span>
                      ) : (
                        <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-700">
                          Unverified
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-neutral-500">{u.transactionCount}</td>
                  <td className="px-3 py-2 text-neutral-500">{u.createdAt.slice(0, 10)}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap justify-end gap-1.5">
                      <a
                        href={`/admin/users/${u.id}/edit`}
                        className={`${btn} border-neutral-300 text-neutral-700 hover:bg-neutral-50`}
                      >
                        Edit
                      </a>
                      {!u.isVerified && (
                        <button
                          onClick={() => patch(u.id, { isVerified: true })}
                          disabled={busy}
                          className={`${btn} border-amber-300 text-amber-700 hover:bg-amber-50`}
                        >
                          Verify
                        </button>
                      )}
                      {u.isDisabled ? (
                        <button
                          onClick={() => patch(u.id, { isDisabled: false })}
                          disabled={busy}
                          className={`${btn} border-green-300 text-green-700 hover:bg-green-50`}
                        >
                          Enable
                        </button>
                      ) : (
                        <button
                          onClick={() => patch(u.id, { isDisabled: true })}
                          disabled={busy || u.isSelf}
                          title={u.isSelf ? "You can't disable your own account" : undefined}
                          className={`${btn} border-neutral-300 text-neutral-600 hover:bg-neutral-50`}
                        >
                          Disable
                        </button>
                      )}
                      <button
                        onClick={() => resetPassword(u.id, u.email)}
                        disabled={busy}
                        className={`${btn} border-blue-300 text-blue-700 hover:bg-blue-50`}
                      >
                        Reset password
                      </button>
                      <button
                        onClick={() => del(u.id, u.email)}
                        disabled={busy || u.isSelf || u.transactionCount > 0}
                        title={
                          u.isSelf
                            ? "You can't delete your own account"
                            : u.transactionCount > 0
                              ? "Has posted transactions — disable instead"
                              : undefined
                        }
                        className={`${btn} border-red-300 text-red-700 hover:bg-red-50`}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
