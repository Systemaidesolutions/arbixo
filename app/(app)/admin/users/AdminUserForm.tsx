"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { SubscriberSubtype, UserRole } from "@prisma/client";
import { SUBTYPE_LABELS, SUBTYPE_DESCRIPTIONS } from "@/lib/permissions";

type CompanyOption = { id: string; tradeName: string };

const SUBTYPES: SubscriberSubtype[] = ["MANAGER", "USER", "REPORT_CREATOR"];
const APPS = [
  { key: "accounting", name: "Accounting" },
  { key: "payroll", name: "Payroll" },
];
const BOTH = ["accounting", "payroll"];

export function AdminUserForm({
  mode,
  userId,
  initial,
  companies,
  initialCompanyAccess = [],
}: {
  mode: "create" | "edit";
  userId?: string;
  initial?: {
    email: string;
    role: UserRole;
    subscriberSubtype: SubscriberSubtype | null;
    companyId: string | null;
    appAccess?: string[];
  };
  companies: CompanyOption[];
  // Companies (beyond the primary one below) this user can already switch
  // into, with the apps they may open in each — see lib/userCompanyAccess.ts.
  // Only meaningful in edit mode.
  initialCompanyAccess?: { companyId: string; apps: string[] }[];
}) {
  const router = useRouter();
  const [email, setEmail] = useState(initial?.email ?? "");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>(initial?.role ?? "USER");
  const [subtype, setSubtype] = useState<SubscriberSubtype>(initial?.subscriberSubtype ?? "USER");
  const [companyId, setCompanyId] = useState<string>(initial?.companyId ?? "");
  const [apps, setApps] = useState<string[]>(initial?.appAccess?.length ? initial.appAccess : ["accounting", "payroll"]);
  // Additional company id -> apps in that company.
  const [grants, setGrants] = useState<Record<string, string[]>>(() =>
    Object.fromEntries(initialCompanyAccess.map((g) => [g.companyId, g.apps.length ? g.apps : BOTH]))
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function toggleCompanyAccess(id: string, checked: boolean) {
    setGrants((prev) => {
      const next = { ...prev };
      if (checked) next[id] = BOTH;
      else delete next[id];
      return next;
    });
  }

  function toggleGrantApp(id: string, app: string, checked: boolean) {
    setGrants((prev) => {
      const cur = prev[id] ?? [];
      return { ...prev, [id]: BOTH.filter((a) => (a === app ? checked : cur.includes(a))) };
    });
  }

  const field = "mt-1 w-full rounded border border-neutral-300 px-2 py-1.5 text-sm";
  const label = "block text-xs text-neutral-500";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (role === "USER" && apps.length === 0) return setError("Tick at least one app for the primary company.");
    const extra = Object.entries(grants).filter(([id]) => id !== companyId);
    const noApps = extra.find(([, a]) => a.length === 0);
    if (role === "USER" && noApps) {
      const name = companies.find((c) => c.id === noApps[0])?.tradeName ?? "an additional company";
      return setError(`Tick Accounting or Payroll for ${name}, or untick the company.`);
    }
    setSaving(true);

    const payload =
      role === "ADMIN"
        ? { email, password, role }
        : { email, password, role, subscriberSubtype: subtype, companyId: companyId || null, appAccess: apps };

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
                : { role, subscriberSubtype: subtype, companyId: companyId || null, appAccess: apps }
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
        body: JSON.stringify({ grants: extra.map(([cid, a]) => ({ companyId: cid, apps: a })) }),
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

          <div>
            <span className={label}>
              Apps in {companies.find((c) => c.id === companyId)?.tradeName ?? "the primary company"}{" "}
              <span className="text-red-500">*</span>
            </span>
            <div className="mt-1 flex flex-wrap gap-4 rounded border border-neutral-300 p-2 text-sm text-neutral-700">
              {APPS.map((a) => (
                <label key={a.key} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={apps.includes(a.key)}
                    onChange={(e) => setApps(BOTH.filter((k) => (k === a.key ? e.target.checked : apps.includes(k))))}
                  />
                  ARbixo {a.name}
                </label>
              ))}
            </div>
            <span className="mt-1 block text-[11px] text-neutral-400">
              Which apps this user can open while working in their primary company. With only one, they go straight
              into it.
            </span>
          </div>

          {mode === "edit" && (
            <div>
              <span className={label}>Additional companies and their apps (optional)</span>
              <p className="mt-1 text-[11px] text-neutral-400">
                Lets this user switch into these companies too, from the dropdown next to their company name — e.g. a
                bookkeeper handling several clients. Tick a company, then choose which apps they can open in it.
              </p>
              <div className="mt-2 max-h-72 overflow-y-auto rounded border border-neutral-300">
                <table className="w-full text-sm text-neutral-700">
                  <thead className="sticky top-0 bg-neutral-50 text-left text-xs text-neutral-500">
                    <tr>
                      <th className="px-2 py-1.5 font-medium">Company</th>
                      {APPS.map((a) => (
                        <th key={a.key} className="w-24 px-2 py-1.5 text-center font-medium">
                          {a.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {companies
                      .filter((c) => c.id !== companyId)
                      .map((c) => {
                        const g = grants[c.id];
                        return (
                          <tr key={c.id} className={g ? "bg-green-50/50" : ""}>
                            <td className="px-2 py-1">
                              <label className="flex items-center gap-2">
                                <input type="checkbox" checked={!!g} onChange={(e) => toggleCompanyAccess(c.id, e.target.checked)} />
                                {c.tradeName}
                              </label>
                            </td>
                            {APPS.map((a) => (
                              <td key={a.key} className="px-2 py-1 text-center">
                                <input
                                  type="checkbox"
                                  aria-label={`${a.name} in ${c.tradeName}`}
                                  disabled={!g}
                                  checked={!!g?.includes(a.key)}
                                  onChange={(e) => toggleGrantApp(c.id, a.key, e.target.checked)}
                                  className="disabled:opacity-30"
                                />
                              </td>
                            ))}
                          </tr>
                        );
                      })}
                    {companies.length <= 1 && (
                      <tr>
                        <td colSpan={3} className="px-2 py-2 text-xs text-neutral-400">
                          No other companies exist yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
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
