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
      className="flex items-center gap-1.5 rounded px-2 py-1.5 text-xs text-white/80 hover:bg-white/10 hover:text-white"
    >
      <LogOut size={14} />
      Log out
    </button>
  );
}
