import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUserRecord } from "@/lib/currentUser";
import { capabilitiesFor } from "@/lib/permissions";
import { BackupClient } from "./BackupClient";

export default async function BackupPage() {
  const user = await getCurrentUserRecord();
  if (!user) redirect("/login");
  const isAdmin = user.role === "ADMIN";
  const isManager = capabilitiesFor(user.role, user.subscriberSubtype).canApprove;
  if (!isAdmin && !isManager) redirect("/");

  const companies = isAdmin
    ? await prisma.company.findMany({ select: { id: true, tradeName: true }, orderBy: { tradeName: "asc" } })
    : [];
  const ownCompany =
    !isAdmin && user.companyId
      ? await prisma.company.findUnique({ where: { id: user.companyId }, select: { id: true, tradeName: true } })
      : null;

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-8 sm:py-12">
      <h1 className="text-xl font-medium text-neutral-900">Data backup</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Download a JSON snapshot of your data. (Credentials are never included.)
      </p>
      <BackupClient isAdmin={isAdmin} companies={companies} ownCompany={ownCompany} />
    </main>
  );
}
