"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    setLoading(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong logging in.");
      return;
    }

    router.push(searchParams.get("next") ?? "/");
    router.refresh();
  }

  const field = "mt-1 w-full rounded border border-neutral-300 px-3 py-2 text-sm";
  const label = "block text-xs text-neutral-500";

  return (
    <div>
      <h1 className="text-lg font-medium text-neutral-900">Log in</h1>
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
        <a href="/forgot-password" className="text-brand-blue hover:underline">
          Forgot password?
        </a>
      </p>
      <p className="mt-2 text-center text-sm text-neutral-500">
        Don't have an account?{" "}
        <a href="/register" className="text-brand-blue hover:underline">
          Register
        </a>
      </p>
    </div>
  );
}
