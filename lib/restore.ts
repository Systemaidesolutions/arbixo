import { prisma } from "@/lib/prisma";
import { setAuditSuppressed } from "@/lib/auditContext";

export class RestoreError extends Error {}

// The JSON backups store dates as ISO strings and Decimals as strings.
// Prisma accepts string Decimals, but DateTime fields need Date objects.
const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;

function reviveRow(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    out[key] = typeof value === "string" && ISO_DATE.test(value) ? new Date(value) : value;
  }
  return out;
}

function reviveRows(rows: unknown): Record<string, unknown>[] {
  if (!Array.isArray(rows)) return [];
  return rows.map((r) => reviveRow(r as Record<string, unknown>));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Tx = any;

type CompanyBackup = {
  company: Record<string, unknown> & { id: string };
  locations?: unknown;
  accounts?: unknown;
  customers?: unknown;
  vendors?: unknown;
  employees?: unknown;
  contacts?: unknown;
  taxPostingSetup?: Record<string, unknown> | null;
  ledgerEntries?: unknown;
  auditLogs?: unknown;
};

/**
 * Overwrites one company's data inside a transaction. The company row is
 * upserted (never deleted, so User.companyId foreign keys stay valid) and
 * all of its scoped child records are replaced. Users are never touched.
 */
async function overwriteCompany(tx: Tx, cb: CompanyBackup): Promise<void> {
  const companyId = cb.company.id;
  const companyRow = reviveRow(cb.company);
  const { id: _id, ...companyData } = companyRow;
  await tx.company.upsert({ where: { id: companyId }, update: companyData, create: companyRow });

  // Delete existing children, FK-safe: entries reference accounts/agents/
  // locations; taxPostingSetup references accounts.
  await tx.ledgerEntry.deleteMany({ where: { companyId } });
  await tx.taxPostingSetup.deleteMany({ where: { companyId } });
  await tx.auditLog.deleteMany({ where: { companyId } });
  await tx.contact.deleteMany({ where: { companyId } });
  await tx.employee.deleteMany({ where: { companyId } });
  await tx.vendor.deleteMany({ where: { companyId } });
  await tx.customer.deleteMany({ where: { companyId } });
  await tx.account.deleteMany({ where: { companyId } });
  await tx.location.deleteMany({ where: { companyId } });

  // Re-insert. Accounts self-reference (parentAccountId), so insert them
  // parent-less first, then wire up parents.
  await tx.location.createMany({ data: reviveRows(cb.locations) });

  const accounts = reviveRows(cb.accounts);
  if (accounts.length) {
    await tx.account.createMany({ data: accounts.map((a) => ({ ...a, parentAccountId: null })) });
    for (const a of accounts) {
      if (a.parentAccountId) {
        await tx.account.update({
          where: { id: a.id as string },
          data: { parentAccountId: a.parentAccountId as string },
        });
      }
    }
  }

  await tx.customer.createMany({ data: reviveRows(cb.customers) });
  await tx.vendor.createMany({ data: reviveRows(cb.vendors) });
  await tx.employee.createMany({ data: reviveRows(cb.employees) });
  await tx.contact.createMany({ data: reviveRows(cb.contacts) });

  if (cb.taxPostingSetup) {
    await tx.taxPostingSetup.create({ data: reviveRow(cb.taxPostingSetup) });
  }

  const ledger = reviveRows(cb.ledgerEntries);
  if (ledger.length) await tx.ledgerEntry.createMany({ data: ledger });

  const logs = reviveRows(cb.auditLogs);
  if (logs.length) await tx.auditLog.createMany({ data: logs });
}

// Preserved entryNo values don't advance the Postgres sequence; nudge it
// past the max so future posts don't reuse numbers.
async function resetLedgerSequence(): Promise<void> {
  try {
    await prisma.$executeRawUnsafe(
      `SELECT setval(pg_get_serial_sequence('"LedgerEntry"', 'entryNo'), COALESCE((SELECT MAX("entryNo") FROM "LedgerEntry"), 1))`
    );
  } catch (err) {
    console.error("[restore] ledger sequence reset failed:", err);
  }
}

/** Overwrite a single company from a per-company backup file. */
export async function restoreCompanyBackup(backup: unknown): Promise<{ companyId: string }> {
  const b = backup as { backupType?: string; company?: { id?: string } };
  if (b?.backupType !== "company" || !b.company?.id) {
    throw new RestoreError("This file isn't a valid per-company backup.");
  }
  const companyId = b.company.id;

  setAuditSuppressed(true);
  try {
    await prisma.$transaction((tx) => overwriteCompany(tx, backup as CompanyBackup), {
      timeout: 60_000,
      maxWait: 15_000,
    });
  } finally {
    setAuditSuppressed(false);
  }
  await resetLedgerSequence();
  return { companyId };
}

/** Overwrite every company + shared ATC codes from a whole-database backup. */
export async function restoreDatabaseBackup(backup: unknown): Promise<{ companies: number }> {
  const b = backup as {
    backupType?: string;
    companies?: Array<Record<string, unknown> & { id: string }>;
    locations?: Array<{ companyId?: string }>;
    accounts?: Array<{ companyId?: string }>;
    customers?: Array<{ companyId?: string }>;
    vendors?: Array<{ companyId?: string }>;
    employees?: Array<{ companyId?: string }>;
    contacts?: Array<{ companyId?: string }>;
    taxPostingSetups?: Array<{ companyId?: string }>;
    ledgerEntries?: Array<{ companyId?: string }>;
    auditLogs?: Array<{ companyId?: string }>;
    atcCodes?: unknown;
  };
  if (b?.backupType !== "database" || !Array.isArray(b.companies)) {
    throw new RestoreError("This file isn't a valid whole-database backup.");
  }

  const forCompany = <T extends { companyId?: string }>(arr: T[] | undefined, cid: string) =>
    (arr ?? []).filter((r) => r.companyId === cid);

  setAuditSuppressed(true);
  try {
    await prisma.$transaction(
      async (tx) => {
        for (const company of b.companies!) {
          await overwriteCompany(tx, {
            company,
            locations: forCompany(b.locations, company.id),
            accounts: forCompany(b.accounts, company.id),
            customers: forCompany(b.customers, company.id),
            vendors: forCompany(b.vendors, company.id),
            employees: forCompany(b.employees, company.id),
            contacts: forCompany(b.contacts, company.id),
            taxPostingSetup: forCompany(b.taxPostingSetups, company.id)[0] ?? null,
            ledgerEntries: forCompany(b.ledgerEntries, company.id),
            auditLogs: forCompany(b.auditLogs, company.id),
          });
        }
        // Shared ATC codes (no company) — replace wholesale.
        const t = tx as Tx;
        await t.atcCode.deleteMany({});
        const atc = reviveRows(b.atcCodes);
        if (atc.length) await t.atcCode.createMany({ data: atc });
      },
      { timeout: 120_000, maxWait: 20_000 }
    );
  } finally {
    setAuditSuppressed(false);
  }
  await resetLedgerSequence();
  return { companies: b.companies.length };
}
