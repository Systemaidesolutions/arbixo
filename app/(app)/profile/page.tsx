import { redirect } from "next/navigation";
import { getCurrentUserRecord } from "@/lib/currentUser";
import { prisma } from "@/lib/prisma";
import { describeLoginHours } from "@/lib/loginHours";
import { ProfileClient } from "./ProfileClient";
import { TwoFactorSection } from "./TwoFactorSection";

export default async function ProfilePage() {
  const user = await getCurrentUserRecord();
  if (!user) redirect("/login");

  const company =
    user.role === "USER" && user.companyId
      ? await prisma.company.findUnique({
          where: { id: user.companyId },
          select: { loginHoursEnabled: true, loginStart: true, loginEnd: true, loginDays: true },
        })
      : null;

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-8">
      <h1 className="text-xl font-semibold text-brand-navy">My Profile</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Manage your name, photo, password and two-factor sign-in.
      </p>

      <ProfileClient
        email={user.email}
        initialName={user.name ?? ""}
        initialPhotoUrl={user.photoUrl}
        role={user.role}
      />

      <div className="mt-6">
        <TwoFactorSection
          initialEnabled={user.totpEnabled}
          required={user.require2fa}
          loginHours={company?.loginHoursEnabled ? describeLoginHours(company) : null}
        />
      </div>
    </main>
  );
}
