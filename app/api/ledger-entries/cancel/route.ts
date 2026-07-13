import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolvePoster } from "@/lib/currentUser";
import { logAudit, getClientIp } from "@/lib/audit";
import { postDocument, DuplicateDocumentError, type LedgerLineInput } from "@/lib/ledgerPosting";
import type { JournalType } from "@prisma/client";

// Cancels a posted document by (a) posting a reversal transaction that
// mirrors it with debits/credits flipped, and (b) flagging both the
// original and the reversal as cancelled with the supplied reason. Every
// report/ledger view already excludes cancelled entries, so the net effect
// is the transaction leaves the books while the reversal stands as the
// audit trail. Cancelling is a Manager-only "edit" power.
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const { companyId, journalType, documentNo } = body ?? {};
  const reason = typeof body?.reason === "string" ? body.reason.trim() : "";

  if (!companyId || !journalType || !documentNo) {
    return NextResponse.json(
      { error: "companyId, journalType, and documentNo are required" },
      { status: 400 }
    );
  }
  if (!reason) {
    return NextResponse.json({ error: "A cancellation reason is required." }, { status: 400 });
  }

  const auth = await resolvePoster(companyId, "canCancel");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const entries = await prisma.ledgerEntry.findMany({
    where: { companyId, journalType: journalType as JournalType, documentNo },
    orderBy: { lineNo: "asc" },
  });
  if (entries.length === 0) {
    return NextResponse.json({ error: "No matching document found" }, { status: 404 });
  }
  if (entries.some((e) => e.isCancelled)) {
    return NextResponse.json({ error: "This transaction is already cancelled." }, { status: 400 });
  }

  // Mirror each line with debit/credit flipped. Amounts/counterparty are
  // carried over; the VAT/withholding breakdown is left off — a reversal is
  // a plain reversing GL entry, and it never reaches the tax reports anyway.
  const reversalLines: LedgerLineInput[] = entries.map((e) => ({
    accountId: e.accountId,
    debitAmount: Number(e.creditAmount),
    creditAmount: Number(e.debitAmount),
    description: `Cancellation of ${documentNo}: ${reason}`,
    referenceNo: e.referenceNo,
    counterpartyType: e.counterpartyType,
    customerId: e.customerId,
    vendorId: e.vendorId,
    employeeId: e.employeeId,
    contactId: e.contactId,
    checkNo: e.checkNo,
  }));

  const reversalDocumentNo = `${documentNo}-CANCEL`;

  try {
    await postDocument({
      companyId,
      locationId: entries[0].locationId,
      journalType: journalType as JournalType,
      documentType: entries[0].documentType,
      documentNo: reversalDocumentNo,
      postingDate: new Date(),
      isReturn: true,
      lines: reversalLines,
      createdById: auth.user.id,
      isApproved: auth.capability.canApprove,
    });
  } catch (err) {
    if (err instanceof DuplicateDocumentError) {
      return NextResponse.json(
        { error: `A reversal (${reversalDocumentNo}) already exists for this document.` },
        { status: 400 }
      );
    }
    throw err;
  }

  // Flag the reversal and the original as cancelled, both carrying the reason.
  await prisma.ledgerEntry.updateMany({
    where: {
      companyId,
      journalType: journalType as JournalType,
      documentNo: { in: [documentNo, reversalDocumentNo] },
    },
    data: { isCancelled: true, cancellationReason: reason },
  });

  await logAudit({
    companyId,
    username: auth.user.email,
    action: `Cancelled ${journalType} ${documentNo} (reversal ${reversalDocumentNo}) — ${reason}`,
    ipAddress: getClientIp(request),
  });

  return NextResponse.json({ ok: true, reversalDocumentNo });
}
