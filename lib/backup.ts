import { prisma } from "@/lib/prisma";

// Users are exported without any credential material (password/reset/
// verification hashes) — a data snapshot, not an auth backup.
const SAFE_USER_SELECT = {
  id: true,
  email: true,
  role: true,
  subscriberSubtype: true,
  companyId: true,
  isVerified: true,
  isDisabled: true,
  createdAt: true,
  updatedAt: true,
} as const;

/** A JSON snapshot of one company and everything scoped to it. */
export async function buildCompanyBackup(companyId: string) {
  const [
    company,
    users,
    locations,
    accounts,
    customers,
    vendors,
    employees,
    contacts,
    taxPostingSetup,
    numberSeries,
    importations,
    ledgerEntries,
    auditLogs,
  ] = await Promise.all([
    prisma.company.findUnique({ where: { id: companyId } }),
    prisma.user.findMany({ where: { companyId }, select: SAFE_USER_SELECT }),
    prisma.location.findMany({ where: { companyId } }),
    prisma.account.findMany({ where: { companyId } }),
    prisma.customer.findMany({ where: { companyId } }),
    prisma.vendor.findMany({ where: { companyId } }),
    prisma.employee.findMany({ where: { companyId } }),
    prisma.contact.findMany({ where: { companyId } }),
    prisma.taxPostingSetup.findUnique({ where: { companyId } }),
    prisma.numberSeries.findMany({ where: { companyId } }),
    prisma.importation.findMany({ where: { companyId } }),
    prisma.ledgerEntry.findMany({ where: { companyId } }),
    prisma.auditLog.findMany({ where: { companyId } }),
  ]);

  return {
    backupType: "company" as const,
    exportedAt: new Date().toISOString(),
    company,
    users,
    locations,
    accounts,
    customers,
    vendors,
    employees,
    contacts,
    taxPostingSetup,
    numberSeries,
    importations,
    ledgerEntries,
    auditLogs,
  };
}

/** A JSON snapshot of every table in the database. */
export async function buildDatabaseBackup() {
  const [
    companies,
    users,
    locations,
    accounts,
    customers,
    vendors,
    employees,
    contacts,
    taxPostingSetups,
    numberSeries,
    importations,
    atcCodes,
    ledgerEntries,
    auditLogs,
  ] = await Promise.all([
    prisma.company.findMany(),
    prisma.user.findMany({ select: SAFE_USER_SELECT }),
    prisma.location.findMany(),
    prisma.account.findMany(),
    prisma.customer.findMany(),
    prisma.vendor.findMany(),
    prisma.employee.findMany(),
    prisma.contact.findMany(),
    prisma.taxPostingSetup.findMany(),
    prisma.numberSeries.findMany(),
    prisma.importation.findMany(),
    prisma.atcCode.findMany(),
    prisma.ledgerEntry.findMany(),
    prisma.auditLog.findMany(),
  ]);

  return {
    backupType: "database" as const,
    exportedAt: new Date().toISOString(),
    companies,
    users,
    locations,
    accounts,
    customers,
    vendors,
    employees,
    contacts,
    taxPostingSetups,
    numberSeries,
    importations,
    atcCodes,
    ledgerEntries,
    auditLogs,
  };
}

/** Filename-safe slug for a backup download. */
export function slugify(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "company";
}
