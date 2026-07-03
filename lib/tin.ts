// Philippine BIR TIN helpers. A TIN is a 9-digit base, optionally followed by
// a branch code (3 digits for older TINs, 5 for newer ones). Head office is
// 000 / 00000. Displayed grouped as 000-000-000[-000[00]].

export function tinDigits(raw: string): string {
  return (raw ?? "").replace(/\D/g, "").slice(0, 14);
}

export function formatTin(raw: string): string {
  const d = tinDigits(raw);
  if (d.length <= 3) return d;
  const parts = [d.slice(0, 3), d.slice(3, 6), d.slice(6, 9)].filter(Boolean);
  const branch = d.slice(9);
  let out = parts.join("-");
  if (branch) out += "-" + branch;
  return out;
}

// Valid lengths: 9 (base only), 12 (9 + 3-digit branch), or 14 (9 + 5-digit).
export function isValidTin(raw: string): boolean {
  const len = tinDigits(raw).length;
  return len === 9 || len === 12 || len === 14;
}

/** For API validation: returns an error string, or null if valid/blank. */
export function tinError(raw: string | null | undefined, { required = false } = {}): string | null {
  const value = (raw ?? "").trim();
  if (!value) return required ? "TIN is required." : null;
  if (!isValidTin(value)) {
    return "TIN must be 9 digits (with an optional 3- or 5-digit branch code), e.g. 000-000-000-00000.";
  }
  return null;
}
