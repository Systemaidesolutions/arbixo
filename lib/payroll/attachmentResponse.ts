import { NextResponse } from "next/server";

/** Serves a stored base64 data URL as a file, inline (for <img> / PDF view). */
export function attachmentResponse(a: { fileName: string; contentType: string; data: string }): NextResponse {
  const b64 = a.data.slice(a.data.indexOf(",") + 1);
  const body = Buffer.from(b64, "base64");
  const safeName = a.fileName.replace(/[^\w.\- ]+/g, "_");
  return new NextResponse(body, {
    headers: {
      "Content-Type": a.contentType,
      "Content-Length": String(body.length),
      "Content-Disposition": `inline; filename="${safeName}"`,
      "Cache-Control": "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
      // Lock image responses down; Chrome won't render a PDF under a sandbox CSP.
      ...(a.contentType.startsWith("image/") ? { "Content-Security-Policy": "default-src 'none'; img-src 'self'; sandbox" } : {}),
    },
  });
}
