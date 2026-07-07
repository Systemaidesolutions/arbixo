import { prisma } from "@/lib/prisma";
import { getCurrentCompany } from "@/lib/currentUser";
import { SlspClient } from "../slsp/SlspClient";

export default async function SlsPage() {
  const company = await getCurrentCompany();
  if (!company) {
    return (
      <main className="mx-auto max-w-3xl p-4 sm:p-8">
        <h1 className="text-xl font-medium text-neutral-900">Summary List of Sales</h1>
        <p className="mt-2 text-neutral-600">Complete company setup first.</p>
      </main>
    );
  }
  const locations = await prisma.location.findMany({
    where: { companyId: company.id },
    orderBy: { name: "asc" },
    select: { id: true, name: true, branchCode: true },
  });
  return (
    <SlspClient
      kind="sls"
      tin={company.tin}
      registeredName={company.registeredName ?? company.tradeName}
      locations={locations}
    />
  );
}
