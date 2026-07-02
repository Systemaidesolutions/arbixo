"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function RegisterForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords don't match");
      return;
    }

    setLoading(true);
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    setLoading(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong registering.");
      return;
    }

    router.push(`/verify?email=${encodeURIComponent(email)}`);
  }

  const field = "mt-1 w-full rounded border border-neutral-300 px-3 py-2 text-sm";
  const label = "block text-xs text-neutral-500";

  return (
    <div>
      <h1 className="text-lg font-medium text-neutral-900">Create an account</h1>
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
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={field}
          />
          <span className="mt-1 block text-xs text-neutral-400">At least 8 characters.</span>
        </label>
        <label className={label}>
          Confirm password
          <input
            type="password"
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className={field}
          />
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded bg-[#0B2A5E] px-4 py-2 text-sm text-white hover:bg-[#123A73] disabled:opacity-50"
        >
          {loading ? "Creating account…" : "Create account"}
        </button>
      </form>

      <p className="mt-4 text-center text-sm text-neutral-500">
        Already have an account?{" "}
        <a href="/login" className="text-brand-blue hover:underline">
          Log in
        </a>
      </p>
    </div>
  );
}
