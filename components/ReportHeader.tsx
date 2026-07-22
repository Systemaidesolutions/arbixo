// Shared print header for financial reports: company letterhead + centered
// report name + date coverage. Presentational (usable in server pages).
export function ReportHeader({
  company,
  title,
  coverage,
}: {
  company: {
    registeredName: string | null;
    tradeName: string;
    businessAddress: string | null;
    barangay: string | null;
    district: string | null;
    city: string | null;
    province: string | null;
    zipCode: string | null;
    tin: string | null;
    logoUrl: string | null;
  };
  title: string;
  coverage: string;
}) {
  const companyName = company.registeredName || company.tradeName;
  const addr = [company.businessAddress, company.barangay, company.district, company.city, company.province, company.zipCode].filter(Boolean).join(", ");
  return (
    // The data-* attributes are what ReportFooter reads to caption each printed
    // page, so the footer always matches this header without every print page
    // having to pass the same two values twice.
    <header
      data-report-company={companyName}
      data-report-title={title}
      className="border-b-2 border-neutral-800 pb-3 text-center"
    >
      <div className="flex flex-col items-center">
        {company.logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={company.logoUrl} alt="" className="mb-1 h-14 w-auto max-w-[120px] object-contain" />
        )}
        <div className="text-base font-bold uppercase">{companyName}</div>
        {addr && <div className="text-[11px] text-neutral-600">{addr}</div>}
        {company.tin && <div className="text-[11px] text-neutral-600">TIN: {company.tin}</div>}
      </div>
      <div className="mt-4 text-center text-2xl font-bold uppercase tracking-[0.2em] text-neutral-900">{title}</div>
      <div className="mt-1 text-center text-xs text-neutral-600">{coverage}</div>
    </header>
  );
}

// Report footer with the page number aligned to the right.
// Real per-page "Page X of Y" footers (measured client-side — browsers can't
// compute page counts in CSS). Re-exported here so the print pages keep
// importing ReportFooter from this module.
export { ReportFooter } from "@/components/PrintPagination";
