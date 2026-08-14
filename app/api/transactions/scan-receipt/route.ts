import { NextRequest, NextResponse } from "next/server";
import { effectiveCompanyId, getCurrentCapability } from "@/lib/currentUser";
import { scanReceiptImage, ReceiptScanUnavailableError, ReceiptScanFailedError } from "@/lib/receiptScan";

// Without this, real (multi-second-to-process) photos hit Vercel's default
// function timeout before the vision API responds — the function gets
// killed outright, showing up as an edge-layer 502 with nothing logged,
// rather than the graceful "could not read" error from lib/receiptScan.ts.
// Must comfortably exceed receiptScan.ts's own worst case: 2 attempts at
// 40s each plus a short retry delay (~82s).
export const maxDuration = 100;

// Matches the ~3 MB raw-file cap enforced client-side, inflated by base64's
// ~4/3 ratio plus slack for the data-URL prefix.
const MAX_IMAGE_BASE64_LENGTH = 4_500_000;

export async function POST(request: NextRequest) {
  const companyId = await effectiveCompanyId();
  if (!companyId) return NextResponse.json({ error: "No company." }, { status: 403 });
  const cap = await getCurrentCapability();
  if (!cap?.canPost) return NextResponse.json({ error: "Your account is read-only." }, { status: 403 });

  const body = await request.json().catch(() => null);
  const image = typeof body?.image === "string" ? body.image : "";
  const match = /^data:([^;]+);base64,(.+)$/.exec(image);
  if (!match) return NextResponse.json({ error: "No image provided." }, { status: 400 });
  const [, mediaType, base64] = match;
  if (!["image/jpeg", "image/png", "image/gif", "image/webp"].includes(mediaType)) {
    return NextResponse.json({ error: "Unsupported image type." }, { status: 400 });
  }
  if (base64.length > MAX_IMAGE_BASE64_LENGTH) {
    return NextResponse.json({ error: "Image is too large (max ~3 MB)." }, { status: 400 });
  }

  try {
    const result = await scanReceiptImage(base64, mediaType);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof ReceiptScanUnavailableError || err instanceof ReceiptScanFailedError) {
      return NextResponse.json({ error: err.message }, { status: 502 });
    }
    console.error("[scan-receipt] failed:", err);
    return NextResponse.json({ error: "Could not read this receipt." }, { status: 500 });
  }
}
