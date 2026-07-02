import { NextRequest, NextResponse } from "next/server";
import { postDocument, DuplicateDocumentError, UnbalancedEntryError } from "@/lib/ledgerPosting";
import {
  expandVatLines,
  counterpartyFields,
  MissingPostingAccountError,
  type ExpandInputLine,
} from "@/lib/vatLineExpansion";
import type { CounterpartyType } from "@prisma/client";

type RequestBody = {
  companyId: string;
  locationId?: string | null;
  documentNo: string;
  postingDate: string;
  counterpartyType?: CounterpartyType | null;
  counterpartyId?: string | null;
  cashAccountId: string;
  particulars?: string | null;
  lines: ExpandInputLine[];
};

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as RequestBody | null;
  if (!body) return NextResponse.json({ error: "Invalid request body" }, { status: 400 });

  const { companyId, documentNo, cashAccountId, postingDate, lines } = body;
  if (!companyId || !documentNo || !cashAccountId || !postingDate || !lines?.length) {
    return NextResponse.json(
      { error: "companyId, documentNo, cashAccountId, postingDate, and at least one line are required" },
      { status: 400 }
    );
  }

  const counterparty = counterpartyFields(body.counterpartyType, body.counterpartyId);
  let glLines, cashAmount: number;

  try {
    const result = await expandVatLines(companyId, lines, "CREDIT", counterparty, body.particulars, documentNo);
    glLines = result.glLines;
    cashAmount = result.balancingAmount; // total credit minus withholding debited
  } catch (err) {
    if (err instanceof MissingPostingAccountError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }

  if (cashAmount <= 0) {
    return NextResponse.json(
      { error: "Computed cash amount is zero or negative — check the line amounts." },
      { status: 400 }
    );
  }

  // Balancing line: cash actually received is what's left after the
  // customer's withholding is deducted — the mirror of Cash
  // Disbursement's balancing Cash credit.
  glLines.push({
    accountId: cashAccountId,
    debitAmount: cashAmount,
    description: body.particulars ?? null,
    ...counterparty,
  });

  try {
    const created = await postDocument({
      companyId,
      locationId: body.locationId ?? null,
      journalType: "CASH_RECEIPT",
      documentType: "RECEIPT",
      documentNo,
      postingDate: new Date(postingDate),
      lines: glLines,
    });
    return NextResponse.json({ entries: created, cashAmount }, { status: 201 });
  } catch (err) {
    if (err instanceof UnbalancedEntryError || err instanceof DuplicateDocumentError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }
}
