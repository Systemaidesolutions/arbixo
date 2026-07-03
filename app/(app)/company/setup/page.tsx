import { getCurrentCompany, getCurrentCapability } from "@/lib/currentUser";
import {
  MONTHS,
  PERIOD_TYPE_LABELS,
  REGISTRATION_TYPE_LABELS,
  TAX_CLASSIFICATION_LABELS,
} from "@/lib/company";
import { NumberSeriesSetup } from "@/components/NumberSeriesSetup";

// Subscribers see their company details read-only. Company records are
// created and edited by an Arbixo admin (see /admin/companies), so there
// is no form here — only a view.
export default async function CompanyDetailsPage() {
  const company = await getCurrentCompany();
  const capability = await getCurrentCapability();
  const canEditSeries = Boolean(capability && !capability.isReadOnly);

  if (!company) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-8 sm:px-8 sm:py-12">
        <h1 className="text-xl font-medium text-neutral-900">Company</h1>
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-5">
          <p className="text-sm text-amber-900">
            No company has been assigned to your account yet. Please contact your Arbixo
            administrator to have your company set up.
          </p>
        </div>
      </main>
    );
  }

  const taxpayerName = [company.taxpayerLastName, company.taxpayerFirstName, company.taxpayerMiddleName]
    .filter(Boolean)
    .join(", ");

  const rows: Array<[string, string | null | undefined]> = [
    ["Trade name", company.tradeName],
    ["TIN", company.tin],
    ["Taxpayer classification", TAX_CLASSIFICATION_LABELS[company.taxClassification]],
    company.taxClassification === "NON_INDIVIDUAL"
      ? ["Registered name", company.registeredName]
      : ["Taxpayer name", taxpayerName],
    [
      "Business address",
      [company.businessAddress, company.barangay, company.city, company.province, company.zipCode]
        .filter(Boolean)
        .join(", "),
    ],
    ["RDO code", company.rdoCode],
    [
      "Period type",
      company.periodType === "FISCAL"
        ? `${PERIOD_TYPE_LABELS[company.periodType]} (ends ${MONTHS[(company.fiscalMonthEnd ?? 12) - 1]})`
        : PERIOD_TYPE_LABELS[company.periodType],
    ],
    ["Registration type", REGISTRATION_TYPE_LABELS[company.registrationType]],
    ["Business type", company.businessType],
    ["Line of business", company.lineOfBusiness],
    ["Telephone", company.telNo],
    ["Fax", company.faxNo],
    ["Authorized representative", company.authorizedRep],
    ["Position", company.authorizedRepPosition],
    [
      "Subscription",
      company.subscriptionEndsAt
        ? `Ends ${new Date(company.subscriptionEndsAt).toISOString().slice(0, 10)}`
        : "—",
    ],
  ];

  return (
    <main className="mx-auto max-w-2xl px-4 py-8 sm:px-8 sm:py-12">
      <h1 className="text-xl font-medium text-neutral-900">Company details</h1>
      <p className="mt-1 text-sm text-neutral-500">
        These details appear on your BIR forms. They're managed by your administrator — contact them
        if anything needs to change.
      </p>

      {company.logoUrl && (
        <div className="mt-6 flex items-center gap-4 rounded-lg border border-neutral-200 bg-neutral-50 p-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={company.logoUrl}
            alt={`${company.tradeName} logo`}
            className="h-16 w-auto max-w-[200px] object-contain"
          />
          <span className="text-sm font-medium text-neutral-700">{company.tradeName}</span>
        </div>
      )}

      <dl className="mt-6 divide-y divide-neutral-100 rounded-lg border border-neutral-200">
        {rows.map(([label, value]) => (
          <div key={label} className="grid grid-cols-1 gap-1 px-4 py-3 sm:grid-cols-3 sm:gap-4">
            <dt className="text-xs uppercase tracking-wide text-neutral-400 sm:text-sm sm:normal-case">
              {label}
            </dt>
            <dd className="text-sm text-neutral-800 sm:col-span-2">{value || "—"}</dd>
          </div>
        ))}
      </dl>

      <NumberSeriesSetup editable={canEditSeries} />
    </main>
  );
}
