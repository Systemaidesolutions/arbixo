import type { VatType } from "@prisma/client";

// Reads a photo of a receipt/official receipt and extracts the fields a
// transaction form needs. Uses the Anthropic Messages API directly (same
// fetch-based approach as lib/askArbiLLM.ts) with vision input and a forced
// tool call for structured output.

const MODEL = "claude-opus-4-8";

export type ScannedReceipt = {
  date: string | null; // YYYY-MM-DD
  payorName: string | null;
  referenceNo: string | null;
  totalAmount: number;
  vatType: VatType;
  particulars: string | null;
  confidence: "high" | "medium" | "low";
};

export class ReceiptScanUnavailableError extends Error {}
export class ReceiptScanFailedError extends Error {}

const VAT_TYPES: VatType[] = ["VAT_12", "ZERO_RATED", "VAT_EXEMPT", "NON_VAT"];

export async function scanReceiptImage(imageBase64: string, mediaType: string): Promise<ScannedReceipt> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new ReceiptScanUnavailableError("Receipt scanning isn't configured on this server.");

  const tool = {
    name: "extract_receipt",
    description: "Extract the fields needed to record this receipt as a Philippine cash receipt (Official Receipt) transaction.",
    input_schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        date: { type: ["string", "null"], description: "The date printed on the receipt, formatted YYYY-MM-DD. Null if not legible." },
        payorName: { type: ["string", "null"], description: "The customer/payor name printed on the receipt (e.g. 'Sold To'), if any. Null if not shown." },
        referenceNo: { type: ["string", "null"], description: "The receipt's own OR number, invoice number, or transaction reference printed on it. Null if not shown." },
        totalAmount: { type: "number", description: "The total amount actually paid/received (the gross amount), in pesos." },
        vatType: {
          type: "string",
          enum: VAT_TYPES,
          description:
            "VAT_12 if the receipt shows a VATable sales + VAT amount breakdown or is marked as VAT-registered; ZERO_RATED if marked zero-rated; VAT_EXEMPT if marked VAT-exempt; NON_VAT otherwise (e.g. a non-VAT/percentage-tax receipt, or no VAT information shown at all).",
        },
        particulars: { type: ["string", "null"], description: "A short (under 10 words) description of what this receipt is for — e.g. the business name and nature of the transaction." },
        confidence: { type: "string", enum: ["high", "medium", "low"], description: "Your overall confidence that totalAmount and vatType were read correctly from the image." },
      },
      required: ["totalAmount", "vatType", "confidence"],
    },
  };

  let res: Response;
  try {
    res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 512,
        tools: [tool],
        tool_choice: { type: "tool", name: "extract_receipt" },
        messages: [
          {
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: mediaType, data: imageBase64 } },
              { type: "text", text: "Extract this receipt's details for a Philippine cash receipt transaction. If a field truly isn't shown or legible, use null rather than guessing." },
            ],
          },
        ],
      }),
      signal: AbortSignal.timeout(45000),
    });
  } catch {
    throw new ReceiptScanFailedError("Could not reach the scanning service. Check your connection and try again.");
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error(`[receiptScan] Anthropic API returned ${res.status}: ${body.slice(0, 500)}`);
    throw new ReceiptScanFailedError(res.status === 429 ? "Scanning is busy right now — try again in a moment." : "Could not read this receipt.");
  }

  const data = (await res.json().catch(() => null)) as { content?: { type: string; name?: string; input?: Record<string, unknown> }[] } | null;
  const toolUse = data?.content?.find((b) => b.type === "tool_use" && b.name === "extract_receipt");
  const input = toolUse?.input as
    | { date?: string | null; payorName?: string | null; referenceNo?: string | null; totalAmount?: number; vatType?: string; particulars?: string | null; confidence?: string }
    | undefined;

  if (!input || typeof input.totalAmount !== "number" || !(input.totalAmount > 0)) {
    throw new ReceiptScanFailedError("Couldn't make out an amount on this receipt — try a clearer photo.");
  }
  const vatType = VAT_TYPES.includes(input.vatType as VatType) ? (input.vatType as VatType) : "NON_VAT";
  const date = input.date && /^\d{4}-\d{2}-\d{2}$/.test(input.date) ? input.date : null;
  const confidence = input.confidence === "high" || input.confidence === "medium" || input.confidence === "low" ? input.confidence : "low";

  return {
    date,
    payorName: input.payorName?.trim() || null,
    referenceNo: input.referenceNo?.trim() || null,
    totalAmount: Math.round(input.totalAmount * 100) / 100,
    vatType,
    particulars: input.particulars?.trim() || null,
    confidence,
  };
}
