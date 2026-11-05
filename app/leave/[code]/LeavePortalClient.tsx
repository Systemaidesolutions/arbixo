"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ReimbursementSection, type PortalReimb } from "./ReimbursementSection";

type Balance = { leaveTypeId: string; code: string; name: string; earned: number; used: number; left: number };
type LeaveTypeOpt = { id: string; code: string; name: string; allowHalfDay: boolean; isPaid: boolean };
type Req = { id: string; type: string; start: string; end: string; days: number; status: string; reason: string | null; note: string | null };

type Props =
  | { mode: "signin"; portal: string; companyName: string }
  | {
      mode: "home";
      portal: string;
      companyName: string;
      employee: { name: string; code: string };
      ready: boolean;
      year: number;
      restWeekdays: number[];
      balances: Balance[];
      types: LeaveTypeOpt[];
      requests: Req[];
      reimbursements: PortalReimb[];
      today: string;
    };

const card = "rounded-xl bg-white p-5 shadow-sm";
const field = "mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-base text-neutral-900";
const label = "block text-sm font-medium text-neutral-700";
const primary = "w-full rounded-lg bg-[#0B2A5E] px-4 py-3 text-base font-medium text-white hover:bg-[#123A73] disabled:opacity-50";

const STATUS: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-800",
  APPROVED: "bg-green-100 text-green-800",
  REJECTED: "bg-red-100 text-red-800",
  CANCELLED: "bg-neutral-200 text-neutral-600",
};
const STATUS_LABEL: Record<string, string> = { PENDING: "Pending approval", APPROVED: "Approved", REJECTED: "Rejected", CANCELLED: "Cancelled" };

function fmt(iso: string) {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-PH", { timeZone: "UTC", month: "short", day: "numeric", year: "numeric" });
}

export function LeavePortalClient(props: Props) {
  return props.mode === "signin" ? <SignIn {...props} /> : <Home {...props} />;
}

function Header({ companyName, right }: { companyName: string; right?: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <div>
        <div className="text-xs font-medium uppercase tracking-wide text-neutral-500">{companyName}</div>
        <h1 className="text-xl font-semibold text-[#0B2A5E]">Leave &amp; reimbursement</h1>
      </div>
      {right}
    </div>
  );
}

function SignIn({ portal, companyName }: { portal: string; companyName: string }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/leave-portal/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ portal, code, pin }),
    }).catch(() => null);
    if (!res?.ok) {
      setBusy(false);
      setPin("");
      const data = res ? await res.json().catch(() => ({})) : {};
      return setError(data.error ?? "Couldn't reach the server. Check your connection and try again.");
    }
    router.refresh();
  }

  return (
    <>
      <Header companyName={companyName} />
      <form onSubmit={submit} className={`${card} space-y-4`}>
        <p className="text-sm text-neutral-600">Sign in with your employee number and the PIN from your HR or payroll staff.</p>
        <label className={label}>
          Employee number
          <input value={code} onChange={(e) => setCode(e.target.value)} required autoFocus autoComplete="username" className={field} />
        </label>
        <label className={label}>
          PIN
          <input
            type="password"
            inputMode="numeric"
            pattern="[0-9]{4,6}"
            maxLength={6}
            required
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            autoComplete="current-password"
            className={`${field} tracking-[0.3em]`}
          />
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="submit" disabled={busy} className={primary}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
        <p className="text-center text-xs text-neutral-500">Forgot your PIN? Ask your HR or payroll staff to reset it.</p>
      </form>
    </>
  );
}

function Home(p: Extract<Props, { mode: "home" }>) {
  const router = useRouter();
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({ leaveTypeId: p.types[0]?.id ?? "", startDate: today, endDate: today, halfDay: false, reason: "" });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [tab, setTab] = useState<"leave" | "reimb">("leave");
  const type = p.types.find((t) => t.id === form.leaveTypeId);
  const canHalf = !!type?.allowHalfDay && form.startDate === form.endDate;

  async function post(url: string, body: object) {
    setBusy(true);
    setMsg(null);
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
    setBusy(false);
    const data = res ? await res.json().catch(() => ({})) : {};
    if (data.signin) {
      router.refresh();
      return false;
    }
    if (!res?.ok) {
      setMsg({ ok: false, text: data.error ?? "Couldn't reach the server. Check your connection and try again." });
      return false;
    }
    return true;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (await post("/api/leave-portal/file", { ...form, halfDay: canHalf && form.halfDay })) {
      setMsg({ ok: true, text: "Leave filed. It's now waiting for approval." });
      setForm((f) => ({ ...f, reason: "", halfDay: false }));
      router.refresh();
    }
  }

  async function withdraw(id: string) {
    if (!confirm("Withdraw this leave filing?")) return;
    if (await post("/api/leave-portal/cancel", { id })) {
      setMsg({ ok: true, text: "Filing withdrawn." });
      router.refresh();
    }
  }

  async function signOut() {
    await fetch("/api/leave-portal/logout", { method: "POST" }).catch(() => null);
    router.refresh();
  }

  return (
    <>
      <Header
        companyName={p.companyName}
        right={
          <button onClick={signOut} className="rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-sm text-neutral-700">
            Sign out
          </button>
        }
      />
      <p className="mb-4 text-sm text-neutral-600">
        Hi <b>{p.employee.name}</b> <span className="text-neutral-400">({p.employee.code})</span>
      </p>

      <div role="tablist" className="mb-4 grid grid-cols-2 gap-1 rounded-xl bg-neutral-200 p-1">
        {(
          [
            ["leave", "Leave"],
            ["reimb", "Reimbursement"],
          ] as const
        ).map(([k, t]) => (
          <button
            key={k}
            role="tab"
            aria-selected={tab === k}
            onClick={() => {
              setTab(k);
              setMsg(null);
            }}
            className={`rounded-lg py-2 text-sm font-medium ${tab === k ? "bg-white text-[#0B2A5E] shadow-sm" : "text-neutral-600"}`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "reimb" ? (
        <ReimbursementSection items={p.reimbursements} ready={p.ready} today={p.today} />
      ) : (
      <>
      {msg && (
        <p className={`mb-4 rounded-lg px-4 py-3 text-sm ${msg.ok ? "bg-green-50 text-green-800" : "bg-red-50 text-red-700"}`}>{msg.text}</p>
      )}

      <section className={card}>
        <h2 className="text-sm font-semibold text-neutral-800">My leave credits ({p.year})</h2>
        {p.balances.length === 0 ? (
          <p className="mt-2 text-sm text-neutral-500">No leave credits recorded for this year yet.</p>
        ) : (
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {p.balances.map((b) => (
              <div key={b.leaveTypeId} className="rounded-lg border border-neutral-200 p-3">
                <div className="text-xs text-neutral-500" title={b.name}>{b.code}</div>
                <div className="text-2xl font-semibold text-[#0B2A5E]">{b.left}</div>
                <div className="text-[11px] text-neutral-500">
                  left · {b.used} used of {b.earned}
                </div>
              </div>
            ))}
          </div>
        )}
        <p className="mt-2 text-[11px] text-neutral-400">Pending filings already count as used.</p>
      </section>

      <section className={`${card} mt-4`}>
        <h2 className="text-sm font-semibold text-neutral-800">File a leave</h2>
        {!p.ready ? (
          <p className="mt-2 text-sm text-neutral-500">Your payroll details aren&apos;t set up yet, so you can&apos;t file leave here. Ask your HR or payroll staff.</p>
        ) : (
          <form onSubmit={submit} className="mt-3 space-y-4">
            <label className={label}>
              Leave type
              <select value={form.leaveTypeId} onChange={(e) => setForm({ ...form, leaveTypeId: e.target.value })} required className={field}>
                {p.types.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.code}){t.isPaid ? "" : " · without pay"}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className={label}>
                From
                <input
                  type="date"
                  required
                  value={form.startDate}
                  onChange={(e) => setForm({ ...form, startDate: e.target.value, endDate: e.target.value > form.endDate ? e.target.value : form.endDate })}
                  className={field}
                />
              </label>
              <label className={label}>
                To
                <input type="date" required min={form.startDate} value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} className={field} />
              </label>
            </div>
            {canHalf && (
              <label className="flex items-center gap-2 text-sm text-neutral-700">
                <input type="checkbox" checked={form.halfDay} onChange={(e) => setForm({ ...form, halfDay: e.target.checked })} className="h-4 w-4" />
                Half day only
              </label>
            )}
            <label className={label}>
              Reason <span className="font-normal text-neutral-400">(optional)</span>
              <textarea value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} rows={2} maxLength={500} className={field} />
            </label>
            <p className="text-[11px] text-neutral-400">Rest days are skipped automatically. Your filing goes to HR or payroll for approval.</p>
            <button type="submit" disabled={busy || !form.leaveTypeId} className={primary}>
              {busy ? "Filing…" : "File leave"}
            </button>
          </form>
        )}
      </section>

      <section className={`${card} mt-4`}>
        <h2 className="text-sm font-semibold text-neutral-800">My filings</h2>
        {p.requests.length === 0 ? (
          <p className="mt-2 text-sm text-neutral-500">No leave filed yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-neutral-100">
            {p.requests.map((r) => (
              <li key={r.id} className="py-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium text-neutral-800">{r.type}</div>
                    <div className="text-sm text-neutral-600">
                      {r.start === r.end ? fmt(r.start) : `${fmt(r.start)} – ${fmt(r.end)}`} · {r.days} day{r.days === 1 ? "" : "s"}
                    </div>
                    {r.reason && <div className="text-xs text-neutral-500">{r.reason}</div>}
                    {r.note && <div className="text-xs text-neutral-500">Note: {r.note}</div>}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS[r.status] ?? ""}`}>{STATUS_LABEL[r.status] ?? r.status}</span>
                    {r.status === "PENDING" && (
                      <button onClick={() => withdraw(r.id)} disabled={busy} className="text-xs text-red-600 hover:underline disabled:opacity-50">
                        Withdraw
                      </button>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
      </>
      )}
    </>
  );
}
