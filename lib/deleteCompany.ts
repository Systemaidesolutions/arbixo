import { prisma } from "@/lib/prisma";
import { setAuditSuppressed } from "@/lib/auditContext";

/**
 * Permanently deletes a company and every record scoped to it, in one
 * transaction. Children are removed FK-safe (ledger entries reference
 * accounts/agents/locations; tax posting setup references accounts) before the
 * company row itself. Assigned users are UNASSIGNED (companyId -> null), not
 * deleted, so their accounts survive and can be reassigned.
 *
 * Audit logging is suppressed for the duration — the audit extension opens a
 * second connection per write, which deadlocks an interactive transaction on
 * the prod pooler (connection_limit=1). Irreversible.
 */
export async function deleteCompany(companyId: string): Promise<void> {
  setAuditSuppressed(true);
  try {
    await prisma.$transaction(
      async (tx) => {
        await tx.ledgerEntry.deleteMany({ where: { companyId } });
        // Inventory module: stock movements reference items; purchase-doc lines
        // cascade with their doc.
        await tx.stockMovement.deleteMany({ where: { companyId } });
        await tx.purchaseDoc.deleteMany({ where: { companyId } });
        await tx.item.deleteMany({ where: { companyId } });
        await tx.transactionAttachment.deleteMany({ where: { companyId } });
        await tx.taxPostingSetup.deleteMany({ where: { companyId } });
        await tx.numberSeries.deleteMany({ where: { companyId } });
        await tx.importation.deleteMany({ where: { companyId } });
        await tx.auditLog.deleteMany({ where: { companyId } });
        await tx.subscriptionPayment.deleteMany({ where: { companyId } });
        await tx.contact.deleteMany({ where: { companyId } });
        await tx.employee.deleteMany({ where: { companyId } });
        await tx.vendor.deleteMany({ where: { companyId } });
        await tx.customer.deleteMany({ where: { companyId } });
        await tx.account.deleteMany({ where: { companyId } });
        await tx.location.deleteMany({ where: { companyId } });
        // Keep user accounts; just detach them from the deleted company.
        await tx.user.updateMany({ where: { companyId }, data: { companyId: null } });
        await tx.company.delete({ where: { id: companyId } });
      },
      { timeout: 60_000, maxWait: 15_000 }
    );
  } finally {
    setAuditSuppressed(false);
  }
}
