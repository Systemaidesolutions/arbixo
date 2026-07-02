import type { PeriodType, RegistrationType, TaxClassification } from "@prisma/client";

export const TAX_CLASSIFICATION_LABELS: Record<TaxClassification, string> = {
  INDIVIDUAL: "Individual (Single Proprietorship)",
  NON_INDIVIDUAL: "Non-Individual (Partnership, Corporation, etc.)",
};

export const REGISTRATION_TYPE_LABELS: Record<RegistrationType, string> = {
  VAT: "VAT Registered",
  NON_VAT: "Non-VAT Registered",
};

export const PERIOD_TYPE_LABELS: Record<PeriodType, string> = {
  CALENDAR: "Calendar",
  FISCAL: "Fiscal",
};

export const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export type CompanyFormPayload = {
  tin: string;
  taxClassification: TaxClassification;
  registeredName?: string | null;
  taxpayerLastName?: string | null;
  taxpayerFirstName?: string | null;
  taxpayerMiddleName?: string | null;
  tradeName: string;
  businessAddress: string;
  zipCode: string;
  rdoCode: string;
  periodType: PeriodType;
  fiscalMonthEnd?: number | null;
  businessType?: string | null;
  registrationType: RegistrationType;
  lineOfBusiness?: string | null;
  telNo?: string | null;
  faxNo?: string | null;
  authorizedRep?: string | null;
  authorizedRepPosition?: string | null;
};

// Mirrors the manual's field-level requirements from section 1.1:
// Reg. Name is required for Non-Individual, Taxpayer Name for Individual;
// Trade Name is always required regardless of classification.
export function validateCompanyPayload(payload: CompanyFormPayload): string | null {
  if (!payload.tin?.trim()) return "TIN is required";
  if (!payload.tradeName?.trim()) return "Trade Name is required";
  if (!payload.businessAddress?.trim()) return "Business Address is required";
  if (!payload.zipCode?.trim()) return "Zip Code is required";
  if (!payload.rdoCode?.trim()) return "RDO is required";

  if (payload.taxClassification === "NON_INDIVIDUAL" && !payload.registeredName?.trim()) {
    return "Registered Name is required for Non-Individual taxpayers";
  }
  if (payload.taxClassification === "INDIVIDUAL") {
    if (!payload.taxpayerLastName?.trim() || !payload.taxpayerFirstName?.trim()) {
      return "Taxpayer Last Name and First Name are required for Individual taxpayers";
    }
  }
  if (payload.periodType === "FISCAL") {
    if (!payload.fiscalMonthEnd || payload.fiscalMonthEnd < 1 || payload.fiscalMonthEnd > 12) {
      return "Fiscal Month End (1-12) is required when Period Type is Fiscal";
    }
  }
  return null;
}
