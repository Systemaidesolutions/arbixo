import type { TaxClassification } from "@prisma/client";
import { firstSpecialCharError } from "@/lib/textValidation";

export type NamePayload = {
  taxClassification: TaxClassification;
  registeredName?: string | null;
  lastName?: string | null;
  firstName?: string | null;
  middleName?: string | null;
  tradeName: string;
  address?: string | null;
  barangay?: string | null;
};

// Same rule as Company: Registered Name for Non-Individual, Last/First
// Name for Individual, Trade Name always required. Shared by Customer,
// Vendor, and Contact — Employee doesn't use taxClassification at all
// (an employee is always an individual).
export function validateNameFields(payload: NamePayload): string | null {
  if (!payload.tradeName?.trim()) return "Trade Name is required";
  if (payload.taxClassification === "NON_INDIVIDUAL" && !payload.registeredName?.trim()) {
    return "Registered Name is required for Non-Individual";
  }
  if (payload.taxClassification === "INDIVIDUAL") {
    if (!payload.lastName?.trim() || !payload.firstName?.trim()) {
      return "Last name and first name are required for Individual";
    }
  }
  return firstSpecialCharError({
    "Trade Name": payload.tradeName,
    "Registered Name": payload.registeredName,
    "Last name": payload.lastName,
    "First name": payload.firstName,
    "Middle name": payload.middleName,
    Address: payload.address,
    Barangay: payload.barangay,
  });
}

/** Special-character check for employee text fields (no taxClassification). */
export function validateEmployeeText(body: {
  lastName?: string | null;
  firstName?: string | null;
  middleName?: string | null;
  position?: string | null;
  address?: string | null;
  barangay?: string | null;
}): string | null {
  return firstSpecialCharError({
    "Last name": body.lastName,
    "First name": body.firstName,
    "Middle name": body.middleName,
    Position: body.position,
    Address: body.address,
    Barangay: body.barangay,
  });
}
