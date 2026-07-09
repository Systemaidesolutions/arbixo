import { requirePostingCompany } from "@/lib/currentUser";
import { prisma } from "@/lib/prisma";
import { formatPeso } from "@/lib/format";

const STATUS_BADGE: Record<string, string> = {
  DRAFT: "bg-neutral-100 text-neutral-600",
  FOR_APPROVAL: "bg-amber-100 text-amber-700",
  APPROVED: "bg-blue-100 text-blue-700",
  POSTED: "bg-green-100 text-green-700",
  CANCELLED: "bg-red-100 text-red-700",
};

export default async function SalesDocsListPage() {
  const company = await requirePostingCompany();
  if (!company) {
    return (
      <main className="mx-auto max-w-4xl p-4 sm:p-8">
        <h1 className="text-xl font-medium text-neutral-900">Sales Order</h1>
        <p className="mt-2 text-neutral-600">Complete company setup first.</p>
      </main>
    );
  }

  const [docs, customers] = await Promise.all([
    prisma.salesDoc.findMany({ where: { companyId: company.id }, orderBy: [{ createdAt: "desc" }], take: 100 }),
    prisma.customer.findMany({ where: { companyId: company.id }, select: { id: true, registeredName: true, lastName: true, firstName: true } }),
  ]);
  const customerName = new Map(customers.map((c) => [c.id, c.registeredName || `${c.lastName ?? ""} ${c.firstName ?? ""}`.trim()]));

  return (
    <main className="mx-auto max-w-5xl p-4 sm:p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-medium text-neutral-900">Sales Order</h1>
          <p className="mt-1 text-sm text-neutral-500">Item-based customer invoices with inventory relief. Drafts can be edited; posted documents are final.</p>
        </div>
        <a href="/transactions/sales-order/new" className="rounded bg-[#0B2A5E] px-4 py-2 text-sm text-white hover:bg-[#123A73]">+ New</a>
      </div>

      <div className="mt-6 overflow-x-auto rounded-lg border border-neutral-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
              <th className="px-3 py-2">Transaction No.</th><th className="px-3 py-2">Date</th><th className="px-3 py-2">Customer</th><th className="px-3 py-2">Reference</th><th className="px-3 py-2 text-right">Amount</th><th className="px-3 py-2">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {docs.length === 0 && <tr><td colSpan={6} className="px-3 py-6 text-center text-neutral-400">No sales documents yet. Click “New” to create one.</td></tr>}
            {docs.map((d) => (
              <tr key={d.id} className="hover:bg-neutral-50">
                <td className="px-3 py-1.5"><a href={`/transactions/sales-order/${d.id}`} className="font-mono text-xs text-brand-blue hover:underline">{d.transactionNo}</a></td>
                <td className="px-3 py-1.5">{new Date(d.transactionDate).toISOString().slice(0, 10)}</td>
                <td className="px-3 py-1.5">{(d.customerId && customerName.get(d.customerId)) || "—"}</td>
                <td className="px-3 py-1.5 text-xs text-neutral-500">{d.referenceNo ?? "—"}</td>
                <td className="px-3 py-1.5 text-right font-mono">{formatPeso(Number(d.totalAmount))}</td>
                <td className="px-3 py-1.5"><span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${STATUS_BADGE[d.status] ?? "bg-neutral-100"}`}>{d.status.replace("_", " ")}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
