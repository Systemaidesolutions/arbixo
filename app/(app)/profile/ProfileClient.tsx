"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { User as UserIcon, Camera } from "lucide-react";

export function ProfileClient({
  email,
  initialName,
  initialPhotoUrl,
  role,
}: {
  email: string;
  initialName: string;
  initialPhotoUrl: string | null;
  role: "ADMIN" | "USER";
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(initialName);
  const [photoUrl, setPhotoUrl] = useState<string | null>(initialPhotoUrl);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPw, setSavingPw] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function onPickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2_000_000) {
      setProfileMsg({ ok: false, text: "Please choose an image under 2MB." });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setPhotoUrl(reader.result as string);
    reader.readAsDataURL(file);
    setProfileMsg(null);
  }

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSavingProfile(true);
    setProfileMsg(null);
    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, photoUrl }),
    });
    setSavingProfile(false);
    if (res.ok) {
      setProfileMsg({ ok: true, text: "Profile saved." });
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setProfileMsg({ ok: false, text: data.error ?? "Could not save profile." });
    }
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwMsg(null);
    if (newPassword !== confirmPassword) {
      setPwMsg({ ok: false, text: "New passwords don't match." });
      return;
    }
    setSavingPw(true);
    const res = await fetch("/api/profile/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    setSavingPw(false);
    if (res.ok) {
      setPwMsg({ ok: true, text: "Password changed." });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } else {
      const data = await res.json().catch(() => ({}));
      setPwMsg({ ok: false, text: data.error ?? "Could not change password." });
    }
  }

  const field =
    "mt-1 w-full rounded border border-neutral-300 px-2.5 py-1.5 text-sm focus:border-brand-blue focus:outline-none";
  const label = "block text-xs font-medium text-neutral-500";

  return (
    <div className="mt-6 space-y-6">
      {/* Profile details */}
      <form
        onSubmit={saveProfile}
        className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm"
      >
        <div className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
          Profile
        </div>

        <div className="mt-4 flex flex-col gap-6 sm:flex-row sm:items-start">
          {/* Photo */}
          <div className="flex flex-col items-center gap-2">
            <div className="relative h-24 w-24 overflow-hidden rounded-full bg-neutral-100 ring-1 ring-neutral-200">
              {photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photoUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="flex h-full w-full items-center justify-center text-neutral-300">
                  <UserIcon size={40} />
                </span>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              onChange={onPickPhoto}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="inline-flex items-center gap-1 text-xs font-medium text-brand-blue hover:underline"
            >
              <Camera size={13} /> Change photo
            </button>
            {photoUrl && (
              <button
                type="button"
                onClick={() => setPhotoUrl(null)}
                className="text-xs text-neutral-400 hover:text-red-500"
              >
                Remove
              </button>
            )}
          </div>

          {/* Fields */}
          <div className="flex-1 space-y-4">
            <label className={label}>
              Name
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                className={field}
              />
            </label>
            <label className={label}>
              Email
              <input value={email} readOnly className={`${field} bg-neutral-50 text-neutral-500`} />
              <span className="mt-1 block text-[11px] text-neutral-400">
                Email is your login and can&apos;t be changed here.
              </span>
            </label>
            <div className="text-[11px] text-neutral-400">
              Role: {role === "ADMIN" ? "Administrator" : "Subscriber"}
            </div>
          </div>
        </div>

        <div className="mt-5 flex items-center gap-3">
          <button
            type="submit"
            disabled={savingProfile}
            className="rounded bg-[#0B2A5E] px-4 py-2 text-sm text-white hover:bg-[#123A73] disabled:opacity-50"
          >
            {savingProfile ? "Saving…" : "Save profile"}
          </button>
          {profileMsg && (
            <span className={`text-sm ${profileMsg.ok ? "text-green-600" : "text-red-600"}`}>
              {profileMsg.text}
            </span>
          )}
        </div>
      </form>

      {/* Change password */}
      <form
        onSubmit={changePassword}
        className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm"
      >
        <div className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
          Change Password
        </div>
        <div className="mt-4 grid gap-4 sm:max-w-md">
          <label className={label}>
            Current password
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              autoComplete="current-password"
              className={field}
            />
          </label>
          <label className={label}>
            New password
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
              className={field}
            />
            <span className="mt-1 block text-[11px] text-neutral-400">At least 8 characters.</span>
          </label>
          <label className={label}>
            Confirm new password
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              className={field}
            />
          </label>
        </div>
        <div className="mt-5 flex items-center gap-3">
          <button
            type="submit"
            disabled={savingPw || !currentPassword || !newPassword}
            className="rounded bg-[#0B2A5E] px-4 py-2 text-sm text-white hover:bg-[#123A73] disabled:opacity-50"
          >
            {savingPw ? "Updating…" : "Update password"}
          </button>
          {pwMsg && (
            <span className={`text-sm ${pwMsg.ok ? "text-green-600" : "text-red-600"}`}>
              {pwMsg.text}
            </span>
          )}
        </div>
      </form>
    </div>
  );
}
