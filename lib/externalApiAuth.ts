import { NextRequest, NextResponse } from "next/server";
import { resolveApiCredential } from "@/lib/apiCredentials";

export type ExternalApiAuth =
  | { ok: true; companyId: string; credentialId: string }
  | { ok: false; status: number; error: string };

/**
 * Authenticates a request to app/api/v1/** against an ApiCredential, via
 * `Authorization: Bearer <key>`. Unlike every other route in this app, these
 * don't go through a logged-in session — middleware.ts lets /api/v1/** through
 * unauthenticated so this check can run instead (see PUBLIC_PREFIXES there).
 */
export async function authenticateExternalApi(request: NextRequest): Promise<ExternalApiAuth> {
  const header = request.headers.get("authorization") ?? "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return { ok: false, status: 401, error: "Missing or malformed Authorization header. Expected: Bearer <api key>." };
  }
  const resolved = await resolveApiCredential(match[1].trim());
  if (!resolved) {
    return { ok: false, status: 401, error: "Invalid or revoked API key." };
  }
  return { ok: true, ...resolved };
}

export function externalApiError(auth: Extract<ExternalApiAuth, { ok: false }>) {
  return NextResponse.json({ error: auth.error }, { status: auth.status });
}
