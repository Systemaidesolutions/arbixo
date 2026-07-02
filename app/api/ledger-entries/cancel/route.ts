import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { JournalType } from "@prisma/client";

export async function PATCH(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const { companyId, journalType, documentNo, isCancelled } = body ?? {};

  if (!companyId || !journalType || !documentNo || typeof isCancelled !== "boolean") {
    return NextResponse.json(
      { error: "companyId, journalType, documentNo, and isCancelled are required" },
      { status: 400 }
    );
  }

  const result = await prisma.ledgerEntry.updateMany({
    where: { companyId, journalType: journalType as JournalType, documentNo },
    data: { isCancelled },
  });

  if (result.count === 0) {
    return NextResponse.json({ error: "No matching document found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, linesUpdated: result.count });
}
