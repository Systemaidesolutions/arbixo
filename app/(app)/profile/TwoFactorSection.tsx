"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";

export function TwoFactorSection({ initialEnabled, loginHours }: { initialEnabled: boolean; loginHours: string | null }) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(initialEnabled);
  const [setup, setSetup] = useState<{ secret: string; uri: string } | null>(null);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [turningOff, setTurningOff] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const field = "mt-1 w-full rounded border border-neutral-300 px-3 py-2 text-sm";
  const label = "block text-xs font-medium text-neutral-600";
  const primary = "rounded bg-[#0B2A5E] px-4 py-2 text-sm text-white hover:bg-[#123A73] disabled:opacity-50";
  const plain = "rounded border border-neutral-300 px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-50";

  async function call(method: "POST" | "DELETE", body: object) {
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/profile/two-factor", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => null);
    setBusy(false);
    const data = res ? await res.json().catch(() => ({})) : {};
    if (!res?.ok) {
      setMsg({ ok: false, text: data.error ?? "Something went wrong." });
      return null;
    }
    return data;
  }

  async function start() {
    const data = await call("POST", { action: "start" });
    if (data) {
      setSetup(data);
      setCode("");
    }
  }

  async function confirm(e: React.FormEvent) {
    e.preventDefault();
    if (await call("POST", { action: "confirm", code })) {
      setEnabled(true);
      setSetup(null);
      setCode("");
      setMsg({ ok: true, text: "Two-factor is on. You'll be asked for a code each time you sign in." });
      router.refresh();
    }
  }

  async function turnOff(e: React.FormEvent) {
    e.preventDefault();
    if (await call("DELETE", { password, code })) {
      setEnabled(false);
      setTurningOff(false);
      setPassword("");
      setCode("");
      setMsg({ ok: true, text: "Two-factor is off." });
      router.refresh();
    }
  }

  return (
    <section className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Two-factor authentication</div>
        <span
          className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
            enabled ? "bg-green-100 text-green-800" : "bg-neutral-100 text-neutral-600"
          }`}
        >
          {enabled ? "On" : "Off"}
        </span>
      </div>
      <p className="mt-2 text-sm text-neutral-600">
        Use an authenticator app (Google Authenticator, Microsoft Authenticator, Authy…) for a 6-digit code at sign-in.
      </p>
      {loginHours && (
        <p className="mt-1 text-xs text-amber-700">
          Your company allows sign-in {loginHours}. Outside those hours you can only sign in with two-factor.
        </p>
      )}

      {!enabled && !setup && (
        <button type="button" onClick={start} disabled={busy} className={`${primary} mt-4`}>
          {busy ? "Starting…" : "Set up two-factor"}
        </button>
      )}

      {setup && (
        <form onSubmit={confirm} className="mt-4 grid gap-4 sm:grid-cols-[auto,1fr]">
          <div className="rounded border border-neutral-200 bg-white p-2 self-start justify-self-start">
            <QRCodeSVG value={setup.uri} size={168} />
          </div>
          <div className="space-y-3 text-sm text-neutral-700">
            <ol className="list-decimal space-y-1 pl-4">
              <li>Open your authenticator app and scan this QR code.</li>
              <li>
                Can&apos;t scan? Enter this key instead:
                <code className="mt-1 block break-all rounded bg-neutral-100 px-2 py-1 font-mono text-xs tracking-wider">
                  {setup.secret.match(/.{1,4}/g)?.join(" ")}
                </code>
              </li>
              <li>Type the 6-digit code the app shows.</li>
            </ol>
            <label className={label}>
              Code
              <input
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={7}
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className={`${field} max-w-[10rem] tracking-[0.3em]`}
              />
            </label>
            <div className="flex gap-2">
              <button type="submit" disabled={busy} className={primary}>
                {busy ? "Checking…" : "Turn on"}
              </button>
              <button type="button" onClick={() => setSetup(null)} className={plain}>
                Cancel
              </button>
            </div>
          </div>
        </form>
      )}

      {enabled && !turningOff && (
        <button type="button" onClick={() => setTurningOff(true)} className={`${plain} mt-4`}>
          Turn off two-factor
        </button>
      )}

      {enabled && turningOff && (
        <form onSubmit={turnOff} className="mt-4 grid gap-3 sm:max-w-md">
          <label className={label}>
            Current password
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              className={field}
            />
          </label>
          <label className={label}>
            Code from your authenticator app
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={7}
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className={`${field} max-w-[10rem] tracking-[0.3em]`}
            />
          </label>
          <div className="flex gap-2">
            <button type="submit" disabled={busy} className={primary}>
              {busy ? "Turning off…" : "Turn off"}
            </button>
            <button type="button" onClick={() => setTurningOff(false)} className={plain}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {msg && <p className={`mt-3 text-sm ${msg.ok ? "text-green-600" : "text-red-600"}`}>{msg.text}</p>}
    </section>
  );
}
