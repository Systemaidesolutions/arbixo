// Pure rules for employee reimbursements (unit-tested). Database work is in
// lib/payroll/reimbursementServer.ts.

export const REIMBURSEMENT_CATEGORIES = [
  "Transportation",
  "Meals",
  "Supplies",
  "Communication",
  "Accommodation",
  "Medical",
  "Others",
] as const;

export const MAX_ATTACHMENTS = 3;
/** Per file, decoded size. Photos are shrunk in the browser before upload. */
export const MAX_ATTACHMENT_BYTES = 1_000_000; // x3 files stays under Vercel's 4.5 MB request limit
export const MAX_AMOUNT = 10_000_000;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

export type AttachmentInput = { fileName: string; dataUrl: string };
export type CleanAttachment = { fileName: string; contentType: string; sizeBytes: number; data: string };
export type ReimbursementInput = {
  expenseDate?: unknown;
  category?: unknown;
  description?: unknown;
  amount?: unknown;
  attachments?: unknown;
};
export type CleanReimbursement = {
  expenseDate: string;
  category: string;
  description: string;
  amount: number;
  attachments: CleanAttachment[];
};

/** Bytes a base64 payload decodes to. */
export function base64Bytes(b64: string): number {
  const pad = b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0;
  return Math.floor((b64.length * 3) / 4) - pad;
}

export function parseAttachment(a: unknown): CleanAttachment | string {
  const fileName = typeof (a as AttachmentInput)?.fileName === "string" ? (a as AttachmentInput).fileName.trim().slice(0, 120) : "";
  const dataUrl = typeof (a as AttachmentInput)?.dataUrl === "string" ? (a as AttachmentInput).dataUrl : "";
  const m = /^data:([a-z]+\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/]+=*)$/.exec(dataUrl);
  if (!m) return "One of the attachments couldn't be read. Attach it again.";
  const contentType = m[1].toLowerCase();
  if (!ALLOWED_TYPES.includes(contentType)) return "Attach receipts as photos (JPG, PNG) or PDF.";
  const sizeBytes = base64Bytes(m[2]);
  if (sizeBytes > MAX_ATTACHMENT_BYTES) return `Each attachment must be under ${Math.round(MAX_ATTACHMENT_BYTES / 1_000_000 * 10) / 10} MB.`;
  return { fileName: fileName || "receipt", contentType, sizeBytes, data: dataUrl };
}

/**
 * Validates a filing. `today` is the filer's date (YYYY-MM-DD); expenses
 * can't be dated in the future. Returns the clean values or an error.
 */
export function parseReimbursement(raw: ReimbursementInput, today: string): CleanReimbursement | string {
  const expenseDate = typeof raw.expenseDate === "string" ? raw.expenseDate : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(expenseDate) || Number.isNaN(Date.parse(`${expenseDate}T00:00:00Z`))) return "Enter the date of the expense.";
  if (expenseDate > today) return "The expense date can't be in the future.";
  const category = typeof raw.category === "string" ? raw.category.trim() : "";
  if (!(REIMBURSEMENT_CATEGORIES as readonly string[]).includes(category)) return "Choose a category.";
  const description = typeof raw.description === "string" ? raw.description.trim().slice(0, 1000) : "";
  if (!description) return "Describe what the expense was for.";
  const amount = Math.round(Number(raw.amount) * 100) / 100;
  if (!Number.isFinite(amount) || amount <= 0) return "Enter the amount.";
  if (amount > MAX_AMOUNT) return "That amount is too large.";
  const list = Array.isArray(raw.attachments) ? raw.attachments : [];
  if (list.length === 0) return "Attach at least one photo of the receipt.";
  if (list.length > MAX_ATTACHMENTS) return `Attach at most ${MAX_ATTACHMENTS} files.`;
  const attachments: CleanAttachment[] = [];
  for (const a of list) {
    const r = parseAttachment(a);
    if (typeof r === "string") return r;
    attachments.push(r);
  }
  return { expenseDate, category, description, amount, attachments };
}

/** Today's date in Philippine time (UTC+8), YYYY-MM-DD. */
export function todayPH(now: Date = new Date()): string {
  return new Date(now.getTime() + 8 * 3600_000).toISOString().slice(0, 10);
}
