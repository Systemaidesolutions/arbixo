// Pure formatting helpers shared by BIR RELIEF exports (SLP/SLS/.DAT
// builders in lib/slsp.ts, and the client-side RELIEF Excel exports). Kept
// dependency-free (no prisma/server imports) so client components can import
// it directly without pulling in server-only code.

export const digitsOnly = (s: string | null | undefined) => (s ?? "").replace(/\D/g, "");

// RELIEF files are positional and comma-delimited with NO quoting, so any
// comma or line break inside a text field shifts every field after it. Strip
// those (and collapse whitespace); other punctuation the validator accepts
// is kept.
export const datText = (s: string | null | undefined) =>
  (s ?? "").replace(/[\r\n]+/g, " ").replace(/,/g, " ").replace(/\s+/g, " ").trim();

// BIR RELIEF identifies a taxpayer by the 9-digit base TIN — the export file
// is itself named "<9-digit TIN>...". Branch codes are not part of the TIN
// field, so use only the first 9 digits.
export const datTin = (s: string | null | undefined) => digitsOnly(s).slice(0, 9);

// TIN formatted "000-000-000" for the RELIEF Excel exports (as opposed to
// datTin's plain-digit .DAT format). An unknown TIN prints as blank groups
// ("   -   -   ") rather than disappearing, matching BIR's own template.
export const tinWithDashes = (s: string | null | undefined) => {
  const d = digitsOnly(s).slice(0, 9).padEnd(9, " ");
  return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6, 9)}`;
};

// TIN + 4-digit branch code, e.g. "651225031-0000" — the header-line TIN
// format BIR's QAP/SAWT Alphalist templates use (unlike SLP/SLS/SLI, which
// print the plain 9-digit TIN with no branch suffix in their header).
export const tinWithBranch = (s: string | null | undefined) => {
  const digits = digitsOnly(s);
  return `${digits.slice(0, 9)}-${digits.slice(9, 13).padEnd(4, "0")}`;
};

// RDO code for BIR files. RDO codes are ALPHANUMERIC (e.g. 037, 54A, 54B), so
// take the leading alphanumeric token — not just digits — and uppercase it.
// Handles bare codes ("54B"), lowercase ("54b" -> "54B") and "code — name"
// strings ("54B — Kawit, West Cavite" -> "54B").
export const datRdo = (s: string | null | undefined) =>
  ((s ?? "").trim().match(/^[0-9A-Za-z]+/)?.[0] ?? "").toUpperCase();

// Match the sample's number style: integers plain, otherwise 2 decimals.
export const amt = (n: number) => (n % 1 === 0 ? String(n) : n.toFixed(2));

export function mmddyyyy(d: Date): string {
  const p = (x: number) => String(x).padStart(2, "0");
  return `${p(d.getMonth() + 1)}/${p(d.getDate())}/${d.getFullYear()}`;
}

// Last day of the month containing d — used to tag a row with its "Taxable
// Month" per BIR's RELIEF listing format.
export const monthEndOf = (d: Date) => new Date(d.getFullYear(), d.getMonth() + 1, 0);

/**
 * BIR RELIEF upload filename, ready to submit: 9-digit TIN + type letter
 * (S = Sales, P = Purchases, I = Importation) + 2-digit month + 4-digit year
 * of the covered tax period. e.g. 123456789S012026.DAT
 */
export function reliefDatFilename(tin: string, kind: "S" | "P" | "I", periodEnd: Date): string {
  const mm = String(periodEnd.getMonth() + 1).padStart(2, "0");
  return `${datTin(tin)}${kind}${mm}${periodEnd.getFullYear()}.DAT`;
}
