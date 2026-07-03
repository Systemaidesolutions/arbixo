// Shared "no special characters" rule for names, addresses, and transaction
// text. Allows Unicode letters (so Filipino ñ and accents work), digits,
// spaces, and a small set of punctuation that legitimately appears in names
// and addresses: . , - ' & ( ) / #. Everything else is rejected.
//
// Deliberately NOT applied to email/website fields (which need @ : etc.).

const ALLOWED = /^[\p{L}\p{N}\s.,'&()/#-]*$/u;
const DISALLOWED = /[^\p{L}\p{N}\s.,'&()/#-]/gu;

export const SPECIAL_CHARS_MESSAGE =
  "must not contain special characters (only letters, numbers, spaces and . , - ' & ( ) / # are allowed)";

export function hasInvalidChars(value: string | null | undefined): boolean {
  return !ALLOWED.test(value ?? "");
}

/** Removes disallowed characters — used for live input filtering on the client. */
export function sanitizeText(value: string): string {
  return value.replace(DISALLOWED, "");
}

/**
 * Validates a set of labelled fields, returning the first error or null.
 * Blank values pass (use separate required checks for that).
 */
export function firstSpecialCharError(fields: Record<string, unknown>): string | null {
  for (const [label, value] of Object.entries(fields)) {
    if (typeof value === "string" && value.trim() && hasInvalidChars(value)) {
      return `${label} ${SPECIAL_CHARS_MESSAGE}.`;
    }
  }
  return null;
}
