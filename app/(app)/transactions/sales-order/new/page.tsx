import { requirePostingCompany } from "@/lib/currentUser";
import { loadSalesFormData } from "@/lib/salesDocFormData";
import { suggestSalesNo } from "@/lib/salesDocs";
import { SalesDocForm } from "../SalesDocForm";

export default async function NewSalesDocPage() {
  const company = await requirePostingCompany();
  if (!company) {
    return (
      <main className="mx-auto max-w-4xl p-4 sm:p-8">
        <h1 className="text-xl font-medium text-neutral-900">Sales Order</h1>
        <p className="mt-2 text-neutral-600">Complete company setup first.</p>
      </main>
    );
  }
  const [data, suggestedNo] = await Promise.all([loadSalesFormData(company.id), suggestSalesNo(company.id)]);
  return (
    <SalesDocForm
      customers={data.customers}
      items={data.items}
      accounts={data.accounts}
      branches={data.branches}
      outputVatAccountId={data.outputVatAccountId}
      suggestedNo={suggestedNo}
    />
  );
}
