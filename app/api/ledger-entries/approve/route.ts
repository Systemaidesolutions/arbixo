import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolvePoster } from "@/lib/currentUser";
import { logAudit, getClientIp } from "@/lib/audit";
import type { JournalType } from "@prisma/client";

// A Manager approves a pending document (all its lines), identified by
// company + journal + document number.
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const { companyId, journalType, documentNo } = body ?? {};

  if (!companyId || !journalType || !documentNo) {
    return NextResponse.json(
      { error: "companyId, journalType, and documentNo are required" },
      { status: 400 }
    );
  }

  const auth = await resolvePoster(companyId, "canApprove");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const result = await prisma.ledgerEntry.updateMany({
    where: { companyId, journalType: journalType as JournalType, documentNo, isApproved: false },
    data: { isApproved: true, approvedById: auth.user.id, approvedAt: new Date() },
  });

  if (result.count === 0) {
    return NextResponse.json(
      { error: "No pending document found to approve." },
      { status: 404 }
    );
  }

  await logAudit({
    companyId,
    username: auth.user.email,
    action: `Approved ${journalType} ${documentNo}`,
    ipAddress: getClientIp(request),
  });

  return NextResponse.json({ ok: true, linesApproved: result.count });
}
