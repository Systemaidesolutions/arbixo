import { notFound } from "next/navigation";
import { requirePostingCompany } from "@/lib/currentUser";
import { get2307Payees } from "@/lib/form2307";
import { resolveBranchScope } from "@/lib/branchScope";
import { Form2307 } from "@/components/Form2307";
import { PrintControls } from "@/components/PrintControls";

// Printable BIR 2307 certificates straight from the report: one payee
// (?payeeId=) or every payee for the period, each on its own page.
export default async function Form2307PrintPage({
  searchParams,
}: {
  searchParams: { from?: string; to?: string; payeeId?: string; locationId?: string };
}) {
  const company = await requirePostingCompany();
  if (!company) notFound();

  const from = searchParams.from;
  const to = searchParams.to;
  if (!from || !to) notFound();

  const branch = await resolveBranchScope(company.id, searchParams.locationId);
  const { payees } = await get2307Payees(
    company.id,
    new Date(`${from}T00:00:00`),
    new Date(`${to}T23:59:59.999`),
    branch
  );

  const selected = searchParams.payeeId
    ? payees.filter((p) => p.id === searchParams.payeeId)
    : payees;
  if (selected.length === 0) notFound();

  const payor = {
    name: company.registeredName || company.tradeName,
    tin: company.tin ?? "",
    address: [
      company.businessAddress,
      company.barangay,
      company.district,
      company.city,
      company.province,
    ]
      .filter(Boolean)
      .join(", "),
    zip: company.zipCode ?? "",
  };

  return (
    <div className="bg-neutral-100 py-4 print:bg-white print:py-0">
      <div className="mx-auto w-[7.9in] print:w-auto">
        <PrintControls auto={false} />
      </div>

      {selected.map((p, i) => (
        <div
          key={p.id}
          // Each certificate starts on a fresh sheet.
          style={i > 0 ? { breakBefore: "page", pageBreakBefore: "always" } : undefined}
          className={i > 0 ? "mt-6 print:mt-0" : ""}
        >
          <Form2307
            autoPrint={false}
            data={{
              payee: { name: p.name, tin: p.tin, address: p.address, zip: p.zip },
              payor,
              postingDate: from,
              periodFrom: from,
              periodTo: to,
              documentNo: "",
              rows: p.rows.map((r) => ({
                atc: r.atc,
                description: r.description,
                income: r.income,
                tax: r.tax,
                months: r.months,
              })),
            }}
          />
        </div>
      ))}
    </div>
  );
}
