import { prisma } from "@/lib/prisma";
import { getCurrentCompany } from "@/lib/currentUser";
import { toPlain } from "@/lib/serialize";
import { GeneralLedgerClient } from "./GeneralLedgerClient";

export default async function GeneralLedgerPage() {
  const company = await getCurrentCompany();

  if (!company) {
    return (
      <main className="mx-auto max-w-4xl p-8">
        <h1 className="text-xl font-medium text-neutral-900">General ledger</h1>
        <p className="mt-2 text-neutral-600">Complete company setup first.</p>
      </main>
    );
  }

  const accounts = await prisma.account.findMany({
    where: { companyId: company.id },
    orderBy: { code: "asc" },
  });

  return <GeneralLedgerClient companyId={company.id} accounts={toPlain(accounts)} />;
}
