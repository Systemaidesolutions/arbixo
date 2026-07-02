import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolvePoster } from "@/lib/currentUser";
import { logAudit, getClientIp } from "@/lib/audit";
import type { JournalType } from "@prisma/client";

// Voiding/cancelling a posted document is a Manager-only "edit" power.
export async function PATCH(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const { companyId, journalType, documentNo, isCancelled } = body ?? {};

  if (!companyId || !journalType || !documentNo || typeof isCancelled !== "boolean") {
    return NextResponse.json(
      { error: "companyId, journalType, documentNo, and isCancelled are required" },
      { status: 400 }
    );
  }

  const auth = await resolvePoster(companyId, "canCancel");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const result = await prisma.ledgerEntry.updateMany({
    where: { companyId, journalType: journalType as JournalType, documentNo },
    data: { isCancelled },
  });

  if (result.count === 0) {
    return NextResponse.json({ error: "No matching document found" }, { status: 404 });
  }

  await logAudit({
    companyId,
    username: auth.user.email,
    action: `${isCancelled ? "Voided" : "Restored"} ${journalType} ${documentNo}`,
    ipAddress: getClientIp(request),
  });

  return NextResponse.json({ ok: true, linesUpdated: result.count });
}
