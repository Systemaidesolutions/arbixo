"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

export function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      onClick={handleLogout}
      className="flex items-center gap-1.5 rounded px-2 py-1.5 text-xs text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900"
    >
      <LogOut size={14} />
      Log out
    </button>
  );
}
