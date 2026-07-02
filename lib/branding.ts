import { prisma } from "@/lib/prisma";

export type BrandingFlags = { background: boolean; login: boolean; headerLogo: boolean };

// Which brand images are set, as cheap booleans — so layouts don't have to
// load the (large) base64 data on every page just to decide whether to show them.
export async function brandingFlags(): Promise<BrandingFlags> {
  try {
    const rows = await prisma.$queryRawUnsafe<Array<{ bg: boolean; login: boolean; header: boolean }>>(
      `SELECT ("backgroundImage" IS NOT NULL) AS bg, ("loginImage" IS NOT NULL) AS login, ("headerLogo" IS NOT NULL) AS header FROM "AppSettings" WHERE id = 'singleton'`
    );
    const r = rows?.[0];
    return { background: !!r?.bg, login: !!r?.login, headerLogo: !!r?.header };
  } catch {
    return { background: false, login: false, headerLogo: false };
  }
}
