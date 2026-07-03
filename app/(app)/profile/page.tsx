import { redirect } from "next/navigation";
import { getCurrentUserRecord } from "@/lib/currentUser";
import { ProfileClient } from "./ProfileClient";

export default async function ProfilePage() {
  const user = await getCurrentUserRecord();
  if (!user) redirect("/login");

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-8">
      <h1 className="text-xl font-semibold text-brand-navy">My Profile</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Manage your name, photo, and password.
      </p>

      <ProfileClient
        email={user.email}
        initialName={user.name ?? ""}
        initialPhotoUrl={user.photoUrl}
        role={user.role}
      />
    </main>
  );
}
