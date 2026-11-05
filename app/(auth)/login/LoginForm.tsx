"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // Second step (two-factor): set once the password checks out.
  const [ticket, setTicket] = useState<string | null>(null);
  const [reason, setReason] = useState<string | null>(null);
  const [code, setCode] = useState("");
  // Set when an admin requires two-factor and the user hasn't set it up yet.
  const [enroll, setEnroll] = useState<{ secret: string; uri: string } | null>(null);

  function goIn() {
    router.push(searchParams.get("next") ?? "/apps");
    router.refresh();
  }

  async function submitCode(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/auth/login/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticket, code, enroll: !!enroll }),
    }).catch(() => null);
    if (!res) {
      setLoading(false);
      return setError("Couldn't reach the server. Check your connection and try again.");
    }
    if (!res.ok) {
      setLoading(false);
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "That code didn't work.");
      setCode("");
      if (data.restart) {
        setTicket(null);
        setEnroll(null);
        setPassword("");
      }
      return;
    }
    goIn();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    let res: Response;
    try {
      res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
    } catch {
      // Network error — re-enable so the user can retry.
      setLoading(false);
      setError("Couldn't reach the server. Check your connection and try again.");
      return;
    }

    if (!res.ok) {
      // Failed login — re-enable the button for another attempt.
      setLoading(false);
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong logging in.");
      return;
    }

    const data = await res.json().catch(() => ({}));
    if (data.needCode && data.ticket) {
      setLoading(false);
      setTicket(data.ticket);
      setReason(data.reason ?? null);
      setEnroll(null);
      return;
    }
    if (data.needEnroll && data.ticket) {
      setLoading(false);
      setTicket(data.ticket);
      setReason(null);
      setEnroll({ secret: data.secret, uri: data.uri });
      return;
    }

    // Success: keep the button disabled while we navigate to the main page.
    // This component unmounts on navigation, so we deliberately do NOT clear
    // `loading` here — otherwise the button re-enables during the (possibly
    // slow) page load and the user could submit again.
    goIn();
  }

  const field = "mt-1 w-full rounded border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900";
  const label = "block text-xs text-blue-100";

  if (ticket) {
    return (
      <form onSubmit={submitCode} className="space-y-3">
        <p className="text-sm text-white">{enroll ? "Set up two-factor authentication" : "Two-factor authentication"}</p>
        {reason && <p className="text-xs text-amber-200">{reason}</p>}
        {enroll && (
          <div className="space-y-2 text-xs text-blue-100">
            <p>Your administrator requires two-factor sign-in on this account. Set it up once now:</p>
            <ol className="list-decimal space-y-1 pl-4">
              <li>Install an authenticator app (Google Authenticator, Microsoft Authenticator, Authy…).</li>
              <li>In the app, add an account and scan this QR code.</li>
            </ol>
            <div className="mx-auto w-fit rounded bg-white p-2">
              <QRCodeSVG value={enroll.uri} size={160} />
            </div>
            <p>
              Can&apos;t scan? Enter this key in the app:
              <code className="mt-1 block break-all rounded bg-white/10 px-2 py-1 text-center font-mono tracking-wider text-white">
                {enroll.secret.match(/.{1,4}/g)?.join(" ")}
              </code>
            </p>
          </div>
        )}
        <label className={label}>
          Enter the 6-digit code from your authenticator app
          <input
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9 ]{6,7}"
            maxLength={7}
            required
            autoFocus
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className={`${field} text-center text-lg tracking-[0.4em]`}
          />
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded bg-[#0B2A5E] px-4 py-2 text-sm text-white hover:bg-[#123A73] disabled:opacity-50"
        >
          {loading ? "Checking…" : enroll ? "Turn on and sign in" : "Verify"}
        </button>
        <button
          type="button"
          onClick={() => {
            setTicket(null);
            setEnroll(null);
            setCode("");
            setError(null);
          }}
          className="w-full text-center text-sm text-sky-300 hover:text-white hover:underline"
        >
          Back
        </button>
        <p className="text-center text-[11px] text-blue-100">
          Lost your phone? Ask your administrator to reset two-factor on your account.
        </p>
      </form>
    );
  }

  return (
    <div>
      <form onSubmit={handleSubmit} className="space-y-3">
        <label className={label}>
          Email
          <input
            type="email"
            required
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={field}
          />
        </label>
        <label className={label}>
          Password
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={field}
          />
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded bg-[#0B2A5E] px-4 py-2 text-sm text-white hover:bg-[#123A73] disabled:opacity-50"
        >
          {loading ? "Logging in…" : "Log in"}
        </button>
      </form>

      <p className="mt-3 text-center text-sm">
        <a href="/forgot-password" className="text-sky-300 hover:text-white hover:underline">
          Forgot password?
        </a>
      </p>
      <p className="mt-2 text-center text-sm text-blue-100">
        Don't have an account?{" "}
        <a href="/register" className="text-sky-300 hover:text-white hover:underline">
          Register
        </a>
      </p>
    </div>
  );
}
