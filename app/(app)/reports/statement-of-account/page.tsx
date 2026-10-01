import { prisma } from "@/lib/prisma";
import { getCurrentCompany } from "@/lib/currentUser";
import { StatementOfAccountClient } from "./StatementOfAccountClient";

export default async function StatementOfAccountPage() {
  const company = await getCurrentCompany();

  if (!company) {
    return (
      <main className="mx-auto max-w-4xl p-4 sm:p-8">
        <h1 className="text-xl font-medium text-neutral-900">Statement of Account</h1>
        <p className="mt-2 text-neutral-600">Complete company setup first.</p>
      </main>
    );
  }

  const [customers, locations] = await Promise.all([
    prisma.customer.findMany({ where: { companyId: company.id }, orderBy: { code: "asc" } }),
    prisma.location.findMany({
      where: { companyId: company.id },
      select: { id: true, name: true, branchCode: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return <StatementOfAccountClient companyId={company.id} customers={customers} locations={locations} />;
}
