import { prisma } from "@/lib/prisma";
import { getCurrentCompany } from "@/lib/currentUser";
import { toPlain } from "@/lib/serialize";
import { AccountsClient } from "./AccountsClient";

export default async function AccountsPage() {
  // TODO: derive companyId from the signed-in user's session once auth is
  // wired up (see the earlier learning-path notes on Clerk/Auth.js). For
  // now this assumes the single-company setup from the manual's "Setup
  // Company" step.
  const company = await getCurrentCompany();

  if (!company) {
    return (
      <main className="mx-auto max-w-4xl p-4 sm:p-8">
        <h1 className="text-xl font-medium text-neutral-900">Chart of accounts</h1>
        <p className="mt-2 text-neutral-600">
          No company is set up yet. Complete company setup before creating accounts.
        </p>
      </main>
    );
  }

  const accounts = await prisma.account.findMany({
    where: { companyId: company.id },
    orderBy: { code: "asc" },
  });

  return <AccountsClient companyId={company.id} initialAccounts={toPlain(accounts)} />;
}
