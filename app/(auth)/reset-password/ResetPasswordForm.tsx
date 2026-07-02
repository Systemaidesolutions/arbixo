"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const uid = searchParams.get("uid") ?? "";
  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  const field = "mt-1 w-full rounded border border-neutral-300 px-3 py-2 text-sm";
  const label = "block text-xs text-neutral-500";

  if (!uid || !token) {
    return (
      <div>
        <h1 className="text-lg font-medium text-neutral-900">Reset password</h1>
        <p className="mt-3 text-sm text-red-600">
          This reset link is invalid. Ask your administrator to send a new one.
        </p>
      </div>
    );
  }

  if (done) {
    return (
      <div>
        <h1 className="text-lg font-medium text-neutral-900">Password updated</h1>
        <p className="mt-3 text-sm text-neutral-600">
          Your password has been changed. You can now log in with your new password.
        </p>
        <a
          href="/login"
          className="mt-4 inline-block w-full rounded bg-[#0B2A5E] px-4 py-2 text-center text-sm text-white hover:bg-[#123A73]"
        >
          Go to login
        </a>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirm) {
      setError("The two passwords don't match.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);
    const res = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uid, token, password }),
    });
    setLoading(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong resetting your password.");
      return;
    }
    setDone(true);
  }

  return (
    <div>
      <h1 className="text-lg font-medium text-neutral-900">Set a new password</h1>
      <form onSubmit={handleSubmit} className="mt-4 space-y-3">
        <label className={label}>
          New password
          <input
            type="password"
            required
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={field}
          />
        </label>
        <label className={label}>
          Confirm new password
          <input
            type="password"
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className={field}
          />
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded bg-[#0B2A5E] px-4 py-2 text-sm text-white hover:bg-[#123A73] disabled:opacity-50"
        >
          {loading ? "Saving…" : "Set new password"}
        </button>
      </form>
    </div>
  );
}
