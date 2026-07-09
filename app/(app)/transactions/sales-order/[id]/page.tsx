import { notFound } from "next/navigation";
import { requirePostingCompany } from "@/lib/currentUser";
import { prisma } from "@/lib/prisma";
import { formatPeso } from "@/lib/format";
import { loadSalesFormData } from "@/lib/salesDocFormData";
import { SalesDocForm } from "../SalesDocForm";

const iso = (d: Date | null) => (d ? new Date(d).toISOString().slice(0, 10) : null);

export default async function SalesDocPage({ params }: { params: { id: string } }) {
  const company = await requirePostingCompany();
  if (!company) return notFound();

  const doc = await prisma.salesDoc.findFirst({ where: { id: params.id, companyId: company.id }, include: { lines: { orderBy: { lineNo: "asc" } } } });
  if (!doc) notFound();

  if (doc.status === "POSTED") {
    return (
      <main className="mx-auto max-w-3xl p-4 sm:p-8">
        <a href="/transactions/sales-order" className="text-sm text-neutral-500 hover:text-neutral-900">← Back</a>
        <div className="mt-2 flex items-center gap-3">
          <h1 className="text-xl font-medium text-neutral-900">Sales Order · {doc.transactionNo}</h1>
          <span className="rounded bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">Posted</span>
        </div>
        <div className="mt-4 rounded-lg border border-neutral-200 p-4 text-sm text-neutral-700">
          <div>Date: {iso(doc.transactionDate)}</div>
          <div>Reference: {doc.referenceNo ?? "—"}</div>
          <div>Remarks: {doc.remarks ?? "—"}</div>
        </div>
        <div className="mt-4 overflow-x-auto rounded-lg border border-neutral-200">
          <table className="w-full text-sm">
            <thead><tr className="bg-neutral-50 text-left text-xs uppercase text-neutral-500"><th className="px-3 py-2">Item</th><th className="px-3 py-2">Description</th><th className="px-3 py-2 text-right">Qty</th><th className="px-3 py-2 text-right">Unit price</th><th className="px-3 py-2 text-right">Amount</th><th className="px-3 py-2 text-right">VAT</th></tr></thead>
            <tbody className="divide-y divide-neutral-100">
              {doc.lines.map((l) => (
                <tr key={l.id}><td className="px-3 py-1.5 font-mono text-xs">{l.itemCode ?? "—"}</td><td className="px-3 py-1.5">{l.description}</td><td className="px-3 py-1.5 text-right font-mono">{Number(l.quantity)}</td><td className="px-3 py-1.5 text-right font-mono">{formatPeso(Number(l.unitPrice))}</td><td className="px-3 py-1.5 text-right font-mono">{formatPeso(Number(l.amount))}</td><td className="px-3 py-1.5 text-right font-mono">{formatPeso(Number(l.vatAmount))}</td></tr>
              ))}
            </tbody>
            <tfoot><tr className="bg-neutral-50 font-medium"><td className="px-3 py-2" colSpan={4}>Total</td><td className="px-3 py-2 text-right font-mono">{formatPeso(Number(doc.totalBeforeVat))}</td><td className="px-3 py-2 text-right font-mono">{formatPeso(Number(doc.totalVat))}</td></tr></tfoot>
          </table>
        </div>
        <p className="mt-3 text-sm text-brand-blue">Total amount: <span className="font-mono font-semibold">{formatPeso(Number(doc.totalAmount))}</span></p>
      </main>
    );
  }

  const data = await loadSalesFormData(company.id);
  const initial = {
    id: doc.id, transactionNo: doc.transactionNo, transactionDate: iso(doc.transactionDate)!, customerId: doc.customerId,
    customerTin: doc.customerTin, locationId: doc.locationId, terms: doc.terms, dueDate: iso(doc.dueDate),
    referenceNo: doc.referenceNo, currency: doc.currency, remarks: doc.remarks, receivableAccountId: doc.receivableAccountId,
    lines: doc.lines.map((l) => ({
      itemId: l.itemId, itemCode: l.itemCode, description: l.description, quantity: Number(l.quantity), uom: l.uom,
      unitPrice: Number(l.unitPrice), discountPercent: Number(l.discountPercent),
      vatType: (l.vatType === "IMPORTATION" ? "VAT_12" : l.vatType) as "VAT_12" | "ZERO_RATED" | "VAT_EXEMPT" | "NON_VAT",
      accountId: l.accountId,
    })),
  };

  return (
    <SalesDocForm initial={initial} customers={data.customers} items={data.items} accounts={data.accounts} branches={data.branches} outputVatAccountId={data.outputVatAccountId} suggestedNo={doc.transactionNo} />
  );
}
