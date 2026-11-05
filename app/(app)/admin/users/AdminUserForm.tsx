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
  // One list for everything: every company this user can open (their home
  // company included) -> the apps they may open there. The home company's
  // apps are saved as User.appAccess, the others as CompanyAccess grants.
  const [access, setAccess] = useState<Record<string, string[]>>(() => {
    const m: Record<string, string[]> = Object.fromEntries(
      initialCompanyAccess.map((g) => [g.companyId, g.apps.length ? g.apps : BOTH])
    );
    if (initial?.companyId) m[initial.companyId] = initial.appAccess?.length ? initial.appAccess : BOTH;
    return m;
  });
  // Companies already ticked are listed first (fixed at load, so rows don't jump while ticking).
  const [firstIds] = useState(() => new Set(Object.keys(access)));
  const [filter, setFilter] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function toggleCompany(id: string, checked: boolean) {
    setAccess((prev) => {
      const next = { ...prev };
      if (checked) next[id] = BOTH;
      else delete next[id];
      return next;
    });
    if (checked && !companyId) setCompanyId(id);
    if (!checked && id === companyId) setCompanyId("");
  }

  function toggleApp(id: string, app: string, checked: boolean) {
    setAccess((prev) => {
      const cur = prev[id] ?? [];
      return { ...prev, [id]: BOTH.filter((a) => (a === app ? checked : cur.includes(a))) };
    });
  }

  function makeHome(id: string) {
    setCompanyId(id);
    setAccess((prev) => (prev[id] ? prev : { ...prev, [id]: BOTH }));
  }

  const listed = companies
    .filter((c) => !filter || c.tradeName.toLowerCase().includes(filter.toLowerCase()))
    .sort((a, b) => Number(firstIds.has(b.id)) - Number(firstIds.has(a.id)));
  const tickedCount = Object.keys(access).length;

  const field = "mt-1 w-full rounded border border-neutral-300 px-2 py-1.5 text-sm";
  const label = "block text-xs text-neutral-500";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const noApps = Object.entries(access).find(([, a]) => a.length === 0);
    if (role === "USER" && noApps) {
      const name = companies.find((c) => c.id === noApps[0])?.tradeName ?? "a company";
      return setError(`Tick Accounting or Payroll for ${name}, or untick the company.`);
    }
    if (role === "USER" && tickedCount > 0 && !companyId) {
      return setError("Choose which ticked company is their Home company.");
    }
    const apps = companyId ? access[companyId] : BOTH;
    const extra = Object.entries(access).filter(([id]) => id !== companyId);
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

    // Additional company access is saved as a second step so a failure here
    // (rare) doesn't read as "the whole save failed" when the user record
    // itself already saved fine. A new user needs the id the create returned.
    const savedId = mode === "edit" ? userId : ((await res.json().catch(() => ({}))) as { user?: { id?: string } }).user?.id;
    if (role === "USER" && savedId && (mode === "edit" || extra.length > 0)) {
      const accessRes = await fetch(`/api/admin/users/${savedId}/company-access`, {
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
    <form onSubmit={handleSubmit} className="mt-6 max-w-xl space-y-4">
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

          <div>
            <span className={label}>Companies and apps</span>
            <p className="mt-1 text-[11px] text-neutral-400">
              Tick each company this user can open and the apps they can use there. <b>Home</b> is where they land
              after logging in; they switch to the others from the dropdown next to their company name. With only one
              app in a company, they go straight into it.
            </p>
            <div className="mt-2 flex items-center gap-2">
              <input
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Find a company"
                className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
              />
              <span className="whitespace-nowrap text-xs text-neutral-500">{tickedCount} ticked</span>
            </div>
            <div className="mt-2 max-h-80 overflow-y-auto rounded border border-neutral-300">
              <table className="w-full text-sm text-neutral-700">
                <thead className="text-left text-xs text-neutral-500">
                  <tr>
                    <th className="sticky top-0 z-10 bg-neutral-100 px-2 py-1.5 font-medium">Company</th>
                    <th className="sticky top-0 z-10 w-14 bg-neutral-100 px-1 py-1.5 text-center font-medium">Home</th>
                    {APPS.map((a) => (
                      <th key={a.key} className="sticky top-0 z-10 w-20 bg-neutral-100 px-1 py-1.5 text-center font-medium">
                        {a.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {listed.map((c) => {
                    const g = access[c.id];
                    const home = c.id === companyId;
                    return (
                      <tr key={c.id} className={home ? "bg-blue-50/60" : g ? "bg-green-50/50" : ""}>
                        <td className="px-2 py-1">
                          <label className="flex items-center gap-2">
                            <input type="checkbox" checked={!!g} onChange={(e) => toggleCompany(c.id, e.target.checked)} />
                            {c.tradeName}
                          </label>
                        </td>
                        <td className="px-1 py-1 text-center">
                          <input
                            type="radio"
                            name="homeCompany"
                            aria-label={`Home company: ${c.tradeName}`}
                            checked={home}
                            onChange={() => makeHome(c.id)}
                          />
                        </td>
                        {APPS.map((a) => (
                          <td key={a.key} className="px-1 py-1 text-center">
                            <input
                              type="checkbox"
                              aria-label={`${a.name} in ${c.tradeName}`}
                              disabled={!g}
                              checked={!!g?.includes(a.key)}
                              onChange={(e) => toggleApp(c.id, a.key, e.target.checked)}
                              className="disabled:opacity-30"
                            />
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                  {listed.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-2 py-2 text-xs text-neutral-400">
                        No companies match.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {tickedCount === 0 && (
              <p className="mt-1 text-[11px] text-neutral-400">
                No company ticked: the user is unassigned for now.
              </p>
            )}
          </div>
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
