"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export function VerifyForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const emailFromQuery = searchParams.get("email") ?? "";
  const hadEmailIssue = searchParams.get("emailIssue") === "1";
  const [email, setEmail] = useState(emailFromQuery);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await fetch("/api/auth/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, code }),
    });

    setLoading(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong verifying this code.");
      return;
    }

    router.push("/");
    router.refresh();
  }

  const field = "mt-1 w-full rounded border border-neutral-300 px-3 py-2 text-sm";
  const label = "block text-xs text-neutral-500";

  return (
    <div>
      <h1 className="text-lg font-medium text-neutral-900">Verify your email</h1>
      <p className="mt-1 text-sm text-neutral-500">Enter the 6-digit code we emailed you.</p>
      {hadEmailIssue && (
        <p className="mt-2 rounded bg-amber-50 px-3 py-2 text-xs text-amber-800">
          We couldn't confirm the email sent — if it doesn't arrive in a minute, ask an admin to
          check the server logs for your code.
        </p>
      )}

      <form onSubmit={handleSubmit} className="mt-4 space-y-3">
        <label className={label}>
          Email
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={field}
          />
        </label>
        <label className={label}>
          Verification code
          <input
            required
            inputMode="numeric"
            maxLength={6}
            autoFocus
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            className={`${field} text-center font-mono text-lg tracking-[0.5em]`}
          />
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded bg-[#0B2A5E] px-4 py-2 text-sm text-white hover:bg-[#123A73] disabled:opacity-50"
        >
          {loading ? "Verifying…" : "Verify"}
        </button>
      </form>

      <p className="mt-4 text-center text-sm text-neutral-500">
        Didn't get a code?{" "}
        <a href="/register" className="text-brand-blue hover:underline">
          Register again
        </a>{" "}
        to resend it.
      </p>
    </div>
  );
}
