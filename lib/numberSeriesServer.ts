import { prisma } from "@/lib/prisma";
import {
  NUMBER_SERIES,
  SERIES_PADDING,
  formatSeriesCode,
  type PartyEntity,
} from "@/lib/numberSeries";

// Creates any missing series rows for a company (defaults), then returns all of
// them ordered like NUMBER_SERIES. Safe to call repeatedly — skipDuplicates
// means existing rows (and any customized prefixes) are left untouched.
export async function ensureDefaultSeries(companyId: string) {
  await prisma.numberSeries.createMany({
    data: NUMBER_SERIES.map((s) => ({
      companyId,
      entityType: s.entityType,
      prefix: s.defaultPrefix,
      nextNumber: 1,
      padding: SERIES_PADDING,
    })),
    skipDuplicates: true,
  });

  const rows = await prisma.numberSeries.findMany({ where: { companyId } });
  const order = NUMBER_SERIES.map((s) => s.entityType as string);
  rows.sort((a, b) => order.indexOf(a.entityType) - order.indexOf(b.entityType));
  return rows;
}

async function codeExists(companyId: string, entityType: PartyEntity, code: string): Promise<boolean> {
  const where = { companyId_code: { companyId, code } };
  switch (entityType) {
    case "customer":
      return Boolean(await prisma.customer.findUnique({ where }));
    case "vendor":
      return Boolean(await prisma.vendor.findUnique({ where }));
    case "employee":
      return Boolean(await prisma.employee.findUnique({ where }));
    case "contact":
      return Boolean(await prisma.contact.findUnique({ where }));
  }
}

/**
 * Atomically reserves and returns the next code for a master-data entity, e.g.
 * "CUST0000001". The DB increment is atomic so concurrent creates can't collide
 * on the same number; if the generated code happens to clash with a manually
 * entered one, it skips ahead until it finds a free number.
 */
export async function nextPartyCode(companyId: string, entityType: PartyEntity): Promise<string> {
  const def = NUMBER_SERIES.find((s) => s.entityType === entityType);
  if (!def) throw new Error(`Unknown number-series entity: ${entityType}`);

  await prisma.numberSeries.upsert({
    where: { companyId_entityType: { companyId, entityType } },
    create: { companyId, entityType, prefix: def.defaultPrefix, nextNumber: 1, padding: SERIES_PADDING },
    update: {},
  });

  for (let attempt = 0; attempt < 100; attempt++) {
    const series = await prisma.numberSeries.update({
      where: { companyId_entityType: { companyId, entityType } },
      data: { nextNumber: { increment: 1 } },
    });
    const used = series.nextNumber - 1; // update() returns the post-increment row
    const code = formatSeriesCode(series.prefix, used, series.padding);
    if (!(await codeExists(companyId, entityType, code))) return code;
    // Otherwise a manual code already took this number — advance and retry.
  }
  throw new Error("Could not allocate a unique code from the number series.");
}
