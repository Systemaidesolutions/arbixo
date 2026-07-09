import { requireAdmin } from "@/lib/currentUser";
import { prisma } from "@/lib/prisma";
import { AtcCodesClient } from "./AtcCodesClient";

export default async function AdminAtcCodesPage() {
  await requireAdmin();
  const codes = await prisma.atcCode.findMany({ orderBy: { code: "asc" } });
  const initial = codes.map((a) => ({
    id: a.id,
    code: a.code,
    description: a.description,
    ratePercent: Number(a.ratePercent),
    incomePaymentType: a.incomePaymentType,
    isActive: a.isActive,
  }));

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-8 sm:py-12">
      <h1 className="text-xl font-medium text-neutral-900">ATC codes</h1>
      <p className="mt-1 text-sm text-neutral-500">
        BIR Alphanumeric Tax Codes for withholding tax — global reference data shared by every
        company. Verify rates against the current BIR issuance. Codes can&apos;t be deleted (to keep
        historical entries meaningful); deactivate instead.
      </p>
      <div className="mt-6">
        <AtcCodesClient initial={initial} />
      </div>
    </main>
  );
}
