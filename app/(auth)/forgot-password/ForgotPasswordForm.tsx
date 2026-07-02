"use client";

import { useState } from "react";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const field = "mt-1 w-full rounded border border-neutral-300 px-3 py-2 text-sm";
  const label = "block text-xs text-neutral-500";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong.");
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <div>
        <h1 className="text-lg font-medium text-neutral-900">Check your email</h1>
        <p className="mt-3 text-sm text-neutral-600">
          If an account exists for <strong>{email}</strong>, a password reset link has been sent. The
          link expires in 1 hour.
        </p>
        <a
          href="/login"
          className="mt-4 inline-block w-full rounded bg-[#0B2A5E] px-4 py-2 text-center text-sm text-white hover:bg-[#123A73]"
        >
          Back to login
        </a>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-lg font-medium text-neutral-900">Forgot password</h1>
      <p className="mt-1 text-xs text-neutral-500">
        Enter your email and we&apos;ll send a link to reset your password.
      </p>
      <form onSubmit={handleSubmit} className="mt-4 space-y-3">
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
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded bg-[#0B2A5E] px-4 py-2 text-sm text-white hover:bg-[#123A73] disabled:opacity-50"
        >
          {loading ? "Sending…" : "Send reset link"}
        </button>
      </form>
      <p className="mt-4 text-center text-sm text-neutral-500">
        <a href="/login" className="text-brand-blue hover:underline">
          Back to login
        </a>
      </p>
    </div>
  );
}
