import { getCurrentCompany, getCurrentCapability } from "@/lib/currentUser";
import { prisma } from "@/lib/prisma";
import { BranchesManager } from "@/components/BranchesManager";

// Subscriber Setup > Branches. A Manager can add/edit/delete branches; other
// subscriber roles see the list read-only. (Admins manage branches per company
// from /admin/companies.)
export default async function BranchesSetupPage() {
  const company = await getCurrentCompany();
  const capability = await getCurrentCapability();
  const canEdit = Boolean(capability?.canApprove);

  if (!company) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-8 sm:px-8 sm:py-12">
        <h1 className="text-xl font-medium text-neutral-900">Branches</h1>
        <p className="mt-2 text-neutral-600">Complete company setup first.</p>
      </main>
    );
  }

  const branches = await prisma.location.findMany({
    where: { companyId: company.id },
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    select: { id: true, name: true, address: true, tin: true, branchCode: true, isDefault: true },
  });

  return (
    <main className="mx-auto max-w-2xl px-4 py-8 sm:px-8 sm:py-12">
      <h1 className="text-xl font-medium text-neutral-900">Branches</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Set up your business branches and their BIR branch codes. Encoders pick a branch on each
        transaction, and BIR reports can be filed per branch.
        {!canEdit && " Only a Manager can change these."}
      </p>

      <div className="mt-6">
        <BranchesManager endpoint="/api/company/branches" initial={branches} canEdit={canEdit} />
      </div>
    </main>
  );
}
