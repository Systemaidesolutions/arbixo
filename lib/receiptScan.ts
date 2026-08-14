import type { VatType } from "@prisma/client";

// Reads a photo of a receipt/official receipt and extracts the fields a
// transaction form needs. Tries Gemini first (Google AI Studio's free tier —
// no billing required, good for evaluating this feature at zero cost) and
// falls back to Claude (Anthropic Messages API, same fetch-based approach as
// lib/askArbiLLM.ts) if only ANTHROPIC_API_KEY is configured. Both use vision
// input + a forced structured-output schema so the shape is identical either
// way — see ScannedReceipt.

// "-latest" alias so this doesn't need to be updated by hand as Google
// ships new Gemini versions (verified 2026-08-14: pinned "gemini-2.0-flash"
// was already gone from the model list by then).
const GEMINI_MODEL = "gemini-flash-latest";
const ANTHROPIC_MODEL = "claude-opus-4-8";

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

const EXTRACTION_PROMPT =
  "Extract this receipt's details for a Philippine cash receipt transaction. If a field truly isn't shown or legible, use null rather than guessing.";

type RawExtraction = {
  date?: string | null;
  payorName?: string | null;
  referenceNo?: string | null;
  totalAmount?: number;
  vatType?: string;
  particulars?: string | null;
  confidence?: string;
};

function normalize(input: RawExtraction | undefined): ScannedReceipt {
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

async function scanWithGemini(imageBase64: string, mediaType: string, apiKey: string): Promise<ScannedReceipt> {
  const schema = {
    type: "OBJECT",
    properties: {
      date: { type: "STRING", nullable: true, description: "The date printed on the receipt, formatted YYYY-MM-DD. Null if not legible." },
      payorName: { type: "STRING", nullable: true, description: "The customer/payor name printed on the receipt (e.g. 'Sold To'), if any. Null if not shown." },
      referenceNo: { type: "STRING", nullable: true, description: "The receipt's own OR number, invoice number, or transaction reference printed on it. Null if not shown." },
      totalAmount: { type: "NUMBER", description: "The total amount actually paid/received (the gross amount), in pesos." },
      vatType: {
        type: "STRING",
        enum: VAT_TYPES,
        description:
          "VAT_12 if the receipt shows a VATable sales + VAT amount breakdown or is marked as VAT-registered; ZERO_RATED if marked zero-rated; VAT_EXEMPT if marked VAT-exempt; NON_VAT otherwise (e.g. a non-VAT/percentage-tax receipt, or no VAT information shown at all).",
      },
      particulars: { type: "STRING", nullable: true, description: "A short (under 10 words) description of what this receipt is for — e.g. the business name and nature of the transaction." },
      confidence: { type: "STRING", enum: ["high", "medium", "low"], description: "Your overall confidence that totalAmount and vatType were read correctly from the image." },
    },
    required: ["totalAmount", "vatType", "confidence"],
  };

  let res: Response;
  try {
    res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ inline_data: { mime_type: mediaType, data: imageBase64 } }, { text: EXTRACTION_PROMPT }],
          },
        ],
        generationConfig: { responseMimeType: "application/json", responseSchema: schema },
      }),
      signal: AbortSignal.timeout(45000),
    });
  } catch {
    throw new ReceiptScanFailedError("Could not reach the scanning service. Check your connection and try again.");
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error(`[receiptScan] Gemini API returned ${res.status}: ${body.slice(0, 500)}`);
    throw new ReceiptScanFailedError(res.status === 429 ? "Scanning is busy right now — try again in a moment." : "Could not read this receipt.");
  }

  const data = (await res.json().catch(() => null)) as { candidates?: { content?: { parts?: { text?: string }[] } }[] } | null;
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  let input: RawExtraction | undefined;
  try {
    input = text ? (JSON.parse(text) as RawExtraction) : undefined;
  } catch {
    input = undefined;
  }
  return normalize(input);
}

async function scanWithAnthropic(imageBase64: string, mediaType: string, apiKey: string): Promise<ScannedReceipt> {
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
        model: ANTHROPIC_MODEL,
        max_tokens: 512,
        tools: [tool],
        tool_choice: { type: "tool", name: "extract_receipt" },
        messages: [
          {
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: mediaType, data: imageBase64 } },
              { type: "text", text: EXTRACTION_PROMPT },
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
  return normalize(toolUse?.input as RawExtraction | undefined);
}

export async function scanReceiptImage(imageBase64: string, mediaType: string): Promise<ScannedReceipt> {
  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey) return scanWithGemini(imageBase64, mediaType, geminiKey);

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (anthropicKey) return scanWithAnthropic(imageBase64, mediaType, anthropicKey);

  throw new ReceiptScanUnavailableError("Receipt scanning isn't configured on this server.");
}
