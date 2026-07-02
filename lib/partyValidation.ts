import type { TaxClassification } from "@prisma/client";

export type NamePayload = {
  taxClassification: TaxClassification;
  registeredName?: string | null;
  lastName?: string | null;
  firstName?: string | null;
  middleName?: string | null;
  tradeName: string;
};

// Same rule as Company: Registered Name for Non-Individual, Last/First
// Name for Individual, Trade Name always required. Shared by Customer,
// Vendor, and Contact — Employee doesn't use taxClassification at all
// (an employee is always an individual).
export function validateNameFields(payload: NamePayload): string | null {
  if (!payload.tradeName?.trim()) return "Trade name is required";
  if (payload.taxClassification === "NON_INDIVIDUAL" && !payload.registeredName?.trim()) {
    return "Registered name is required for Non-Individual";
  }
  if (payload.taxClassification === "INDIVIDUAL") {
    if (!payload.lastName?.trim() || !payload.firstName?.trim()) {
      return "Last name and first name are required for Individual";
    }
  }
  return null;
}
