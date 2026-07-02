import { NextRequest, NextResponse } from "next/server";
import { postDocument, DuplicateDocumentError, UnbalancedEntryError } from "@/lib/ledgerPosting";
import { resolvePoster } from "@/lib/currentUser";
import {
  expandVatLines,
  counterpartyFields,
  flipLines,
  MissingPostingAccountError,
  type ExpandInputLine,
} from "@/lib/vatLineExpansion";
import type { CounterpartyType } from "@prisma/client";

type RequestBody = {
  companyId: string;
  locationId?: string | null;
  documentNo: string; // Invoice no., or CM no. when isReturn
  postingDate: string;
  isReturn?: boolean;
  counterpartyType?: CounterpartyType | null; // normally CUSTOMER
  counterpartyId?: string | null;
  receivableAccountId: string;
  particulars?: string | null;
  lines: ExpandInputLine[];
};

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as RequestBody | null;
  if (!body) return NextResponse.json({ error: "Invalid request body" }, { status: 400 });

  const { companyId, documentNo, receivableAccountId, postingDate, lines } = body;
  if (!companyId || !documentNo || !receivableAccountId || !postingDate || !lines?.length) {
    return NextResponse.json(
      {
        error:
          "companyId, documentNo, receivableAccountId, postingDate, and at least one line are required",
      },
      { status: 400 }
    );
  }

  const auth = await resolvePoster(companyId, "canPost");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const counterparty = counterpartyFields(body.counterpartyType ?? "CUSTOMER", body.counterpartyId);
  let glLines, receivableAmount: number;

  try {
    // CREDIT direction: same as Cash Receipts — Sales/Output VAT are
    // credited, withholding companion is a debit (asset).
    const result = await expandVatLines(companyId, lines, "CREDIT", counterparty, body.particulars, documentNo);
    glLines = result.glLines;
    receivableAmount = result.balancingAmount;
  } catch (err) {
    if (err instanceof MissingPostingAccountError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }

  if (receivableAmount <= 0) {
    return NextResponse.json(
      { error: "Computed receivable amount is zero or negative — check the line amounts." },
      { status: 400 }
    );
  }

  // Balancing line: unlike Cash Receipts, no cash moves yet — the full
  // amount owed (net of any withholding pre-recorded) becomes a
  // receivable, collected later via a Cash Receipts entry against this
  // same customer.
  glLines.push({
    accountId: receivableAccountId,
    debitAmount: receivableAmount,
    description: body.particulars ?? null,
    ...counterparty,
  });

  // A Sales Return is the same entry, reversed — not a separate rule set.
  const finalLines = body.isReturn ? flipLines(glLines) : glLines;

  try {
    const created = await postDocument({
      companyId,
      locationId: body.locationId ?? null,
      journalType: "SALES_ON_ACCOUNT",
      documentType: body.isReturn ? "CREDIT_MEMO" : "INVOICE",
      documentNo,
      postingDate: new Date(postingDate),
      isReturn: body.isReturn ?? false,
      lines: finalLines,
      createdById: auth.user.id,
      isApproved: auth.capability.canApprove,
    });
    return NextResponse.json({ entries: created, receivableAmount }, { status: 201 });
  } catch (err) {
    if (err instanceof UnbalancedEntryError || err instanceof DuplicateDocumentError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }
}
