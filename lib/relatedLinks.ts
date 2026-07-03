import { prisma } from "@/lib/prisma";

export type DisplayLink = { id: string; name: string; url: string; hasLogo: boolean };

/**
 * Related links for display (dashboard + admin list). Deliberately omits the
 * base64 logo blob — callers render it via /api/related-links/[id]/logo so it
 * never ships inside the page HTML.
 */
export async function getDisplayLinks(): Promise<DisplayLink[]> {
  const links = await prisma.relatedLink.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: { id: true, name: true, url: true, logoUrl: true },
  });
  return links.map((l) => ({ id: l.id, name: l.name, url: l.url, hasLogo: !!l.logoUrl }));
}

/** Ensure a link has a scheme so the browser treats it as an external URL. */
export function normalizeUrl(raw: string): string {
  const s = raw.trim();
  if (!s) return s;
  if (/^https?:\/\//i.test(s)) return s;
  return `https://${s}`;
}

/** Validate an optional base64 image data URL; returns an error string or null. */
export function validateLogo(logoUrl: unknown): string | null {
  if (logoUrl === null || logoUrl === undefined || logoUrl === "") return null;
  if (typeof logoUrl !== "string" || !logoUrl.startsWith("data:image/")) {
    return "Invalid logo image.";
  }
  if (logoUrl.length > 1_500_000) {
    return "Logo is too large. Please use an image under 1MB.";
  }
  return null;
}
