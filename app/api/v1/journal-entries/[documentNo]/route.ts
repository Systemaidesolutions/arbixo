import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateExternalApi, externalApiError } from "@/lib/externalApiAuth";

// Lets a caller confirm whether a batch it submitted was received and
// posted, or find out it wasn't posted at all — addresses "how do you
// confirm a batch was received" without needing a webhook.
export async function GET(request: NextRequest, { params }: { params: { documentNo: string } }) {
  const auth = await authenticateExternalApi(request);
  if (!auth.ok) return externalApiError(auth);

  const documentNo = decodeURIComponent(params.documentNo);
  const entries = await prisma.ledgerEntry.findMany({
    where: { companyId: auth.companyId, journalType: "GENERAL_JOURNAL", documentNo },
    orderBy: { lineNo: "asc" },
    select: {
      lineNo: true,
      postingDate: true,
      isCancelled: true,
      cancellationReason: true,
      account: { select: { code: true, title: true } },
      debitAmount: true,
      creditAmount: true,
      description: true,
    },
  });

  if (entries.length === 0) {
    return NextResponse.json({ documentNo, status: "not_found" }, { status: 404 });
  }

  const cancelled = entries.every((e) => e.isCancelled);
  return NextResponse.json({
    documentNo,
    status: cancelled ? "cancelled" : "posted",
    postingDate: entries[0].postingDate,
    cancellationReason: cancelled ? entries[0].cancellationReason : null,
    lines: entries.map((e) => ({
      accountCode: e.account.code,
      accountTitle: e.account.title,
      debit: Number(e.debitAmount),
      credit: Number(e.creditAmount),
      description: e.description,
    })),
  });
}
