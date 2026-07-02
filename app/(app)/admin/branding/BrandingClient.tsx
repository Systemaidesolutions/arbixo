"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { BrandingFlags } from "@/lib/branding";

const MAX_BYTES = 1.5 * 1024 * 1024;

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

const SLOTS: { key: keyof BrandingFlags; slot: string; label: string; hint: string }[] = [
  { key: "background", slot: "background", label: "App background", hint: "Shown behind the app content on every page." },
  { key: "login", slot: "login", label: "Login page image", hint: "Background of the login / register / reset screens." },
  { key: "headerLogo", slot: "header-logo", label: "Header logo", hint: "Replaces the ARbixo wordmark in the top bar." },
];

function SlotCard({ slot, label, hint, set }: { slot: string; label: string; hint: string; set: boolean }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [ver, setVer] = useState(0);
  const [present, setPresent] = useState(set);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function post(dataUrl: string | null) {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/admin/branding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slot, dataUrl }),
    });
    setBusy(false);
    if (!res.ok) {
      setError((await res.json().catch(() => ({})))?.error ?? "Upload failed.");
      return false;
    }
    setVer((v) => v + 1);
    router.refresh();
    return true;
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    if (!file.type.startsWith("image/")) return setError("Please choose an image file.");
    if (file.size > MAX_BYTES) return setError("Image is too large (max ~1.5 MB).");
    const dataUrl = await readAsDataUrl(file);
    if (await post(dataUrl)) setPresent(true);
  }

  async function remove() {
    if (await post(null)) {
      setPresent(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="rounded-lg border border-neutral-200 p-4">
      <div className="text-sm font-medium text-neutral-800">{label}</div>
      <div className="text-xs text-neutral-500">{hint}</div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        {present && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/api/branding/${slot}?v=${ver}`}
            alt={label}
            className="h-12 w-24 rounded border border-neutral-200 bg-neutral-50 object-cover"
          />
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          disabled={busy}
          onChange={onFile}
          className="text-sm text-neutral-600 file:mr-3 file:rounded file:border file:border-neutral-300 file:bg-white file:px-3 file:py-1.5 file:text-sm"
        />
        {present && (
          <button
            onClick={remove}
            disabled={busy}
            className="rounded border border-red-300 px-3 py-1.5 text-xs text-red-700 hover:bg-red-50 disabled:opacity-50"
          >
            Remove
          </button>
        )}
        {error && <span className="text-xs text-red-600">{error}</span>}
      </div>
    </div>
  );
}

export function BrandingClient({ flags }: { flags: BrandingFlags }) {
  return (
    <div className="mt-6 space-y-4">
      {SLOTS.map((s) => (
        <SlotCard key={s.slot} slot={s.slot} label={s.label} hint={s.hint} set={flags[s.key]} />
      ))}
    </div>
  );
}
