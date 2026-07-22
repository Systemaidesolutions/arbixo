import { getCurrentCompany } from "@/lib/currentUser";
import { prisma } from "@/lib/prisma";
import { GeneralLedgerBookClient } from "./GeneralLedgerBookClient";

export default async function GeneralLedgerBookPage() {
  const company = await getCurrentCompany();
  if (!company) {
    return (
      <main className="mx-auto max-w-3xl p-4 sm:p-8">
        <h1 className="text-xl font-medium text-neutral-900">General Ledger</h1>
        <p className="mt-2 text-neutral-600">Complete company setup first.</p>
      </main>
    );
  }
  const locations = await prisma.location.findMany({
    where: { companyId: company.id },
    select: { id: true, name: true, branchCode: true },
    orderBy: { name: "asc" },
  });
  return <GeneralLedgerBookClient registeredName={company.registeredName ?? company.tradeName} locations={locations} />;
}
