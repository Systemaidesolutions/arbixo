import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUserRecord, effectiveCompanyId, getCurrentCapability } from "@/lib/currentUser";
import { getAdminActingAsCompanyId } from "@/lib/adminActingAs";
import { getAuditTrail } from "@/lib/audit";
import { AuditTrailClient } from "./AuditTrailClient";

export default async function AuditTrailPage() {
  const user = await getCurrentUserRecord();
  if (!user) redirect("/login");
  const isAdmin = user.role === "ADMIN" && !getAdminActingAsCompanyId();
  const scopedCompanyId = await effectiveCompanyId();
  const cap = await getCurrentCapability();
  const isManager = !!scopedCompanyId && !!cap?.canApprove;
  if (!isAdmin && !isManager) redirect("/dashboard");

  const companyId = isAdmin ? undefined : scopedCompanyId ?? undefined;
  const [rows, companies] = await Promise.all([
    getAuditTrail({ companyId }),
    isAdmin
      ? prisma.company.findMany({ select: { id: true, tradeName: true }, orderBy: { tradeName: "asc" } })
      : Promise.resolve([]),
  ]);

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-8 sm:py-12">
      <h1 className="text-xl font-medium text-neutral-900">Audit trail</h1>
      <p className="mt-1 text-sm text-neutral-500">
        {isAdmin
          ? "Logins and transaction activity across all companies. Filter by company below."
          : "Logins and transaction activity for your company."}
      </p>
      <AuditTrailClient isAdmin={isAdmin} companies={companies} initialRows={rows} />
    </main>
  );
}
