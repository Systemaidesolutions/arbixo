import crypto from "crypto";
import { prisma } from "@/lib/prisma";

// Credentials for the external integration API (app/api/v1/**) — lets a
// partner's own system (e.g. a cooperative's core banking system) post and
// read a company's books without a logged-in session. Modeled on the same
// "show the secret once, store only a hash" pattern as everything else in
// this app that handles a credential.

const KEY_PREFIX = "arbx_live_";

function randomToken(): string {
  return crypto.randomBytes(24).toString("base64url");
}

export function hashApiKey(key: string): string {
  return crypto.createHash("sha256").update(key).digest("hex");
}

/**
 * Creates a new credential for a company and returns the plaintext key —
 * the ONLY time it's ever available. Only `keyPrefix` (for the UI to tell
 * credentials apart) and `keyHash` are persisted.
 */
export async function createApiCredential(companyId: string, name: string, createdById: string | null) {
  const plaintext = `${KEY_PREFIX}${randomToken()}`;
  const keyPrefix = plaintext.slice(0, KEY_PREFIX.length + 8);
  const credential = await prisma.apiCredential.create({
    data: { companyId, name, keyPrefix, keyHash: hashApiKey(plaintext), createdById },
  });
  return { credential, plaintext };
}

export async function listApiCredentials(companyId: string) {
  return prisma.apiCredential.findMany({
    where: { companyId },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, keyPrefix: true, createdAt: true, lastUsedAt: true, revokedAt: true },
  });
}

/** Revokes a credential — scoped to companyId so a company can only revoke its own. */
export async function revokeApiCredential(companyId: string, id: string): Promise<boolean> {
  const result = await prisma.apiCredential.updateMany({
    where: { id, companyId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  return result.count > 0;
}

/**
 * Resolves a presented API key to the company it belongs to, or null if
 * it's missing, unknown, or revoked. Updates lastUsedAt best-effort (never
 * blocks or fails the caller's request over it).
 */
export async function resolveApiCredential(key: string): Promise<{ companyId: string; credentialId: string } | null> {
  if (!key || !key.startsWith(KEY_PREFIX)) return null;
  const credential = await prisma.apiCredential.findFirst({
    where: { keyHash: hashApiKey(key), revokedAt: null },
    select: { id: true, companyId: true },
  });
  if (!credential) return null;
  prisma.apiCredential.update({ where: { id: credential.id }, data: { lastUsedAt: new Date() } }).catch(() => {});
  return { companyId: credential.companyId, credentialId: credential.id };
}
