// Payslip output layouts, chosen per company in Payroll › Setup › Payslip layout
// (like report layouts in Business Central). Three ready-made layouts plus a
// Custom one the company builds from these options. Pure: used by the payslip
// page and by the live preview on the setup screen.

export type PayslipLayoutKind = "STANDARD" | "COMPACT" | "DETAILED" | "CUSTOM";
export const LAYOUT_KINDS: PayslipLayoutKind[] = ["STANDARD", "COMPACT", "DETAILED", "CUSTOM"];

export type PayslipOptions = {
  title: string; // heading on the slip, e.g. "PAYSLIP" or "PAY ADVICE"
  perPage: 1 | 2 | 3; // payslips per printed page
  fontSize: "small" | "normal";
  showLogo: boolean;
  showAddress: boolean;
  showTin: boolean;
  showEmployeeCode: boolean;
  showPosition: boolean;
  showBranch: boolean;
  showAttendance: boolean; // days worked, absences, late, OT and night hours
  showEmployerShare: boolean; // employer SSS / PhilHealth / Pag-IBIG
  showLeaveTaken: boolean;
  showLeaveBalances: boolean;
  showSignature: boolean;
  signatureLabel: string;
  showPreparedBy: boolean; // "Prepared by" and "Approved by" lines
  preparedByLabel: string;
  approvedByLabel: string;
  footerNote: string; // e.g. "This is a confidential document."
};

export const LAYOUT_LABEL: Record<PayslipLayoutKind, string> = {
  STANDARD: "Standard",
  COMPACT: "Compact",
  DETAILED: "Detailed",
  CUSTOM: "Custom",
};

export const LAYOUT_DESCRIPTION: Record<PayslipLayoutKind, string> = {
  STANDARD: "The default. Two payslips per page with earnings, deductions, leave taken and leave balances, and a signature line.",
  COMPACT: "Three short payslips per page: earnings, deductions and net pay only. Saves paper for large crews.",
  DETAILED: "One payslip per page with the company logo and TIN, branch, attendance, employer contributions, leave, and Prepared / Approved by lines.",
  CUSTOM: "Your own layout: choose the title, how many per page, which sections show, signature lines and a footer note.",
};

export const PRESETS: Record<Exclude<PayslipLayoutKind, "CUSTOM">, PayslipOptions> = {
  STANDARD: {
    title: "PAYSLIP", perPage: 2, fontSize: "small",
    showLogo: false, showAddress: true, showTin: false, showEmployeeCode: true, showPosition: true, showBranch: false,
    showAttendance: false, showEmployerShare: false, showLeaveTaken: true, showLeaveBalances: true,
    showSignature: true, signatureLabel: "Received by / date",
    showPreparedBy: false, preparedByLabel: "Prepared by", approvedByLabel: "Approved by", footerNote: "",
  },
  COMPACT: {
    title: "PAYSLIP", perPage: 3, fontSize: "small",
    showLogo: false, showAddress: false, showTin: false, showEmployeeCode: true, showPosition: false, showBranch: false,
    showAttendance: false, showEmployerShare: false, showLeaveTaken: false, showLeaveBalances: false,
    showSignature: true, signatureLabel: "Received by / date",
    showPreparedBy: false, preparedByLabel: "Prepared by", approvedByLabel: "Approved by", footerNote: "",
  },
  DETAILED: {
    title: "PAYSLIP", perPage: 1, fontSize: "normal",
    showLogo: true, showAddress: true, showTin: true, showEmployeeCode: true, showPosition: true, showBranch: true,
    showAttendance: true, showEmployerShare: true, showLeaveTaken: true, showLeaveBalances: true,
    showSignature: true, signatureLabel: "Received by / date",
    showPreparedBy: true, preparedByLabel: "Prepared by", approvedByLabel: "Approved by", footerNote: "",
  },
};

const BOOL_KEYS = [
  "showLogo", "showAddress", "showTin", "showEmployeeCode", "showPosition", "showBranch", "showAttendance",
  "showEmployerShare", "showLeaveTaken", "showLeaveBalances", "showSignature", "showPreparedBy",
] as const;
const TEXT_KEYS = { title: 40, signatureLabel: 40, preparedByLabel: 40, approvedByLabel: 40, footerNote: 300 } as const;

export const isLayoutKind = (v: unknown): v is PayslipLayoutKind => LAYOUT_KINDS.includes(v as PayslipLayoutKind);

/** Cleans saved/posted custom options; anything missing or invalid takes the Standard value. */
export function cleanOptions(raw: unknown): PayslipOptions {
  const src = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const out: PayslipOptions = { ...PRESETS.STANDARD };
  for (const k of BOOL_KEYS) if (typeof src[k] === "boolean") out[k] = src[k] as boolean;
  for (const [k, max] of Object.entries(TEXT_KEYS) as [keyof typeof TEXT_KEYS, number][]) {
    if (typeof src[k] === "string") out[k] = (src[k] as string).replace(/\s+/g, " ").trim().slice(0, max);
  }
  if (!out.title) out.title = "PAYSLIP";
  if (src.perPage === 1 || src.perPage === 2 || src.perPage === 3) out.perPage = src.perPage;
  if (src.fontSize === "small" || src.fontSize === "normal") out.fontSize = src.fontSize;
  return out;
}

/** The options a company's payslips print with. */
export function resolvePayslipOptions(kind: string | null | undefined, custom: unknown): PayslipOptions {
  if (kind === "CUSTOM") return cleanOptions(custom);
  if (kind === "COMPACT" || kind === "DETAILED") return PRESETS[kind];
  return PRESETS.STANDARD;
}
