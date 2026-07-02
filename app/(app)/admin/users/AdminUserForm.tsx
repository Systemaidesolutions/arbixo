"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { SubscriberSubtype, UserRole } from "@prisma/client";
import { SUBTYPE_LABELS, SUBTYPE_DESCRIPTIONS } from "@/lib/permissions";

type CompanyOption = { id: string; tradeName: string };

const SUBTYPES: SubscriberSubtype[] = ["MANAGER", "USER", "REPORT_CREATOR"];

export function AdminUserForm({
  mode,
  userId,
  initial,
  companies,
}: {
  mode: "create" | "edit";
  userId?: string;
  initial?: {
    email: string;
    role: UserRole;
    subscriberSubtype: SubscriberSubtype | null;
    companyId: string | null;
  };
  companies: CompanyOption[];
}) {
  const router = useRouter();
  const [email, setEmail] = useState(initial?.email ?? "");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>(initial?.role ?? "USER");
  const [subtype, setSubtype] = useState<SubscriberSubtype>(initial?.subscriberSubtype ?? "USER");
  const [companyId, setCompanyId] = useState<string>(initial?.companyId ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const field = "mt-1 w-full rounded border border-neutral-300 px-2 py-1.5 text-sm";
  const label = "block text-xs text-neutral-500";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    const payload =
      role === "ADMIN"
        ? { email, password, role }
        : { email, password, role, subscriberSubtype: subtype, companyId: companyId || null };

    const res =
      mode === "create"
        ? await fetch("/api/admin/users", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch(`/api/admin/users/${userId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(
              role === "ADMIN"
                ? { role }
                : { role, subscriberSubtype: subtype, companyId: companyId || null }
            ),
          });
    setSaving(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong saving the user.");
      return;
    }
    router.push("/admin/users");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 max-w-md space-y-4">
      <label className={label}>
        Email
        <input
          type="email"
          required
          value={email}
          disabled={mode === "edit"}
          onChange={(e) => setEmail(e.target.value)}
          className={`${field} disabled:bg-neutral-50 disabled:text-neutral-500`}
        />
      </label>

      {mode === "create" && (
        <label className={label}>
          Temporary password
          <input
            type="text"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 8 characters"
            className={field}
          />
          <span className="mt-1 block text-[11px] text-neutral-400">
            Give this to the user; they can change it after logging in.
          </span>
        </label>
      )}

      <label className={label}>
        User Type
        <select value={role} onChange={(e) => setRole(e.target.value as UserRole)} className={field}>
          <option value="USER">Subscriber</option>
          <option value="ADMIN">Admin</option>
        </select>
      </label>

      {role === "USER" && (
        <>
          <label className={label}>
            Subscriber Subtype <span className="text-red-500">*</span>
            <select
              value={subtype}
              onChange={(e) => setSubtype(e.target.value as SubscriberSubtype)}
              className={field}
            >
              {SUBTYPES.map((s) => (
                <option key={s} value={s}>
                  {SUBTYPE_LABELS[s]}
                </option>
              ))}
            </select>
            <span className="mt-1 block text-[11px] text-neutral-400">
              {SUBTYPE_DESCRIPTIONS[subtype]}
            </span>
          </label>

          <label className={label}>
            Company (optional)
            <select value={companyId} onChange={(e) => setCompanyId(e.target.value)} className={field}>
              <option value="">— Unassigned —</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.tradeName}
                </option>
              ))}
            </select>
          </label>
        </>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          className="rounded bg-brand-navy px-4 py-2 text-sm text-white hover:bg-brand-navyLight disabled:opacity-50"
        >
          {saving ? "Saving…" : mode === "create" ? "Create user" : "Save changes"}
        </button>
        <a href="/admin/users" className="text-sm text-neutral-500 hover:text-neutral-900">
          Cancel
        </a>
      </div>
    </form>
  );
}
