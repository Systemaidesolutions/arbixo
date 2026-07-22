import { getCurrentCompany } from "@/lib/currentUser";
import { prisma } from "@/lib/prisma";
import { IncomeStatementClient } from "./IncomeStatementClient";

export default async function IncomeStatementPage() {
  const company = await getCurrentCompany();

  if (!company) {
    return (
      <main className="mx-auto max-w-3xl p-4 sm:p-8">
        <h1 className="text-xl font-medium text-neutral-900">Income statement</h1>
        <p className="mt-2 text-neutral-600">Complete company setup first.</p>
      </main>
    );
  }

  const locations = await prisma.location.findMany({
    where: { companyId: company.id },
    select: { id: true, name: true, branchCode: true },
    orderBy: { name: "asc" },
  });

  return <IncomeStatementClient companyId={company.id} locations={locations} />;
}
