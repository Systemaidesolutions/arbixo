// Standard BIR Expanded Withholding Tax (EWT) Alphanumeric Tax Codes (ATC).
// Codes are GLOBAL (shared by every company). This is a CURATED common set, not
// the complete BIR catalogue — load the full official list via Admin → ATC codes
// → Import (CSV). Rates follow RR 2-98 as amended (incl. RR 11-2018 / TRAIN);
// BIR revises them, so an admin should VERIFY each rate against the latest BIR
// issuance. `incomePaymentType` (GOODS/SERVICES/BOTH) drives the Nature filter on
// transaction lines. Seeding upserts with `update:{}`, so admin edits are never
// overwritten.

export type AtcSeed = {
  code: string;
  description: string;
  ratePercent: number;
  incomePaymentType: "GOODS" | "SERVICES" | "BOTH";
};

export const STANDARD_ATC_CODES: AtcSeed[] = [
  // Existing starter codes (kept as-is).
  { code: "WC100", description: "Rentals — real/personal property, poles, satellites & transmission facilities, billboards — Corporate", ratePercent: 5, incomePaymentType: "BOTH" },
  { code: "WC158", description: "Income payments by a Top Withholding Agent to local/resident suppliers of GOODS — Corporate", ratePercent: 1, incomePaymentType: "GOODS" },
  { code: "WC160", description: "Income payments by a Top Withholding Agent to local/resident suppliers of SERVICES — Corporate", ratePercent: 2, incomePaymentType: "SERVICES" },
  { code: "WI158", description: "Income payments by a Top Withholding Agent to local/resident suppliers of GOODS — Individual", ratePercent: 1, incomePaymentType: "GOODS" },
  { code: "WV010", description: "Income payments by a Top Withholding Agent to local/resident suppliers of GOODS (VAT supplier)", ratePercent: 1, incomePaymentType: "GOODS" },

  // Professional / talent fees.
  { code: "WI010", description: "Professional/talent fees, etc. — Individual (gross income for the year ≤ ₱3M)", ratePercent: 5, incomePaymentType: "SERVICES" },
  { code: "WI011", description: "Professional/talent fees, etc. — Individual (gross income > ₱3M or VAT-registered)", ratePercent: 10, incomePaymentType: "SERVICES" },
  { code: "WC010", description: "Professional/talent fees, etc. — Corporate (gross income for the year ≤ ₱720K)", ratePercent: 10, incomePaymentType: "SERVICES" },
  { code: "WC011", description: "Professional/talent fees, etc. — Corporate (gross income > ₱720K)", ratePercent: 15, incomePaymentType: "SERVICES" },

  // Professional fees paid to medical practitioners.
  { code: "WI152", description: "Professional fees paid to medical practitioners — Individual (≤ ₱3M)", ratePercent: 5, incomePaymentType: "SERVICES" },
  { code: "WC152", description: "Professional fees paid to medical practitioners — Corporate (≤ ₱720K)", ratePercent: 10, incomePaymentType: "SERVICES" },

  // Rentals — individual counterpart of WC100.
  { code: "WI100", description: "Rentals — real/personal property, poles, satellites & transmission facilities, billboards — Individual", ratePercent: 5, incomePaymentType: "BOTH" },

  // Cinematographic film rentals.
  { code: "WI120", description: "Cinematographic film rentals & other payments — Individual", ratePercent: 5, incomePaymentType: "SERVICES" },
  { code: "WC120", description: "Cinematographic film rentals & other payments — Corporate", ratePercent: 5, incomePaymentType: "SERVICES" },

  // Contractors / sub-contractors.
  { code: "WI157", description: "Income payments to certain contractors (general engineering/building, specialty, other) — Individual", ratePercent: 2, incomePaymentType: "SERVICES" },
  { code: "WC157", description: "Income payments to certain contractors (general engineering/building, specialty, other) — Corporate", ratePercent: 2, incomePaymentType: "SERVICES" },

  // Top Withholding Agent — services, individual counterpart of WC160.
  { code: "WI160", description: "Income payments by a Top Withholding Agent to local/resident suppliers of SERVICES — Individual", ratePercent: 2, incomePaymentType: "SERVICES" },
];
