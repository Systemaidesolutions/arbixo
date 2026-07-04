import { getCurrentCompany, getCurrentCapability } from "@/lib/currentUser";
import { ImportationsForm } from "./ImportationsForm";

export default async function ImportationsPage() {
  const company = await getCurrentCompany();
  if (!company) {
    return (
      <main className="mx-auto max-w-3xl p-4 sm:p-8">
        <h1 className="text-xl font-medium text-neutral-900">Importations</h1>
        <p className="mt-2 text-neutral-600">Complete company setup first.</p>
      </main>
    );
  }
  const capability = await getCurrentCapability();
  return <ImportationsForm companyId={company.id} canPost={Boolean(capability && !capability.isReadOnly)} />;
}
