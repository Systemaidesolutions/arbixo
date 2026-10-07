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
  initialCompanyAccessIds = [],
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
  // Companies (beyond the primary one below) this user can already switch
  // into — see lib/userCompanyAccess.ts. Only meaningful in edit mode.
  initialCompanyAccessIds?: string[];
}) {
  const router = useRouter();
  const [email, setEmail] = useState(initial?.email ?? "");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>(initial?.role ?? "USER");
  const [subtype, setSubtype] = useState<SubscriberSubtype>(initial?.subscriberSubtype ?? "USER");
  const [companyId, setCompanyId] = useState<string>(initial?.companyId ?? "");
  const [companyAccessIds, setCompanyAccessIds] = useState<string[]>(initialCompanyAccessIds);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function toggleCompanyAccess(id: string, checked: boolean) {
    setCompanyAccessIds((prev) => (checked ? [...prev, id] : prev.filter((x) => x !== id)));
  }

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
    if (!res.ok) {
      setSaving(false);
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong saving the user.");
      return;
    }

    // Additional company access is only meaningful for an existing
    // subscriber account — saved as a second step so a failure here (rare)
    // doesn't read as "the whole save failed" when the user record itself
    // already saved fine.
    if (mode === "edit" && role === "USER") {
      const accessRes = await fetch(`/api/admin/users/${userId}/company-access`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyIds: companyAccessIds }),
      });
      if (!accessRes.ok) {
        setSaving(false);
        const data = await accessRes.json().catch(() => ({}));
        setError(data.error ?? "Saved the user, but couldn't save their additional company access.");
        return;
      }
    }

    setSaving(false);
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
            <span className="mt-1 block text-[11px] text-neutral-400">
              Their primary/home company — always accessible, and where they land after logging in.
            </span>
          </label>

          {mode === "edit" && (
            <div>
              <span className={label}>Additional companies (optional)</span>
              <p className="mt-1 text-[11px] text-neutral-400">
                Lets this user switch into these companies too, from a dropdown next to their company name — e.g.
                a bookkeeper handling several clients. Their primary company above doesn&apos;t need to be checked
                here; it&apos;s always accessible.
              </p>
              <div className="mt-2 max-h-48 space-y-1 overflow-y-auto rounded border border-neutral-300 p-2">
                {companies
                  .filter((c) => c.id !== companyId)
                  .map((c) => (
                    <label key={c.id} className="flex items-center gap-2 text-sm text-neutral-700">
                      <input
                        type="checkbox"
                        checked={companyAccessIds.includes(c.id)}
                        onChange={(e) => toggleCompanyAccess(c.id, e.target.checked)}
                      />
                      {c.tradeName}
                    </label>
                  ))}
                {companies.length <= 1 && <p className="text-xs text-neutral-400">No other companies exist yet.</p>}
              </div>
            </div>
          )}
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
