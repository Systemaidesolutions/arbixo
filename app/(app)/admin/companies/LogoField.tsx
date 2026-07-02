"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

const MAX_BYTES = 400 * 1024; // 400 KB — logos are small

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

export function LogoField({ companyId, initial }: { companyId: string; initial: string | null }) {
  const router = useRouter();
  const [preview, setPreview] = useState<string | null>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function patch(logoUrl: string | null, okMsg: string) {
    setBusy(true);
    setError(null);
    setMsg(null);
    const res = await fetch(`/api/admin/companies/${companyId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ logoUrl }),
    });
    setBusy(false);
    if (!res.ok) {
      setError((await res.json().catch(() => ({})))?.error ?? "Upload failed.");
      return false;
    }
    setMsg(okMsg);
    router.refresh();
    return true;
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setMsg(null);
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("Image is too large (max 400 KB). Please use a smaller logo.");
      return;
    }
    const dataUrl = await readAsDataUrl(file);
    if (await patch(dataUrl, "Logo uploaded.")) setPreview(dataUrl);
  }

  async function remove() {
    if (await patch(null, "Logo removed.")) {
      setPreview(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <section className="rounded-lg border border-neutral-200 p-4">
      <h2 className="text-sm font-medium text-neutral-800">Company logo</h2>
      <p className="mt-1 text-xs text-neutral-500">
        Upload an image (max 400 KB) — shown on the subscriber&apos;s dashboard.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        {preview && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={preview}
            alt="Company logo"
            className="h-12 w-auto max-w-[160px] rounded border border-neutral-200 bg-white object-contain"
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
        {preview && (
          <button
            onClick={remove}
            disabled={busy}
            className="rounded border border-red-300 px-3 py-1.5 text-xs text-red-700 hover:bg-red-50 disabled:opacity-50"
          >
            Remove
          </button>
        )}
        {msg && <span className="text-xs text-green-600">{msg}</span>}
        {error && <span className="text-xs text-red-600">{error}</span>}
      </div>
    </section>
  );
}
