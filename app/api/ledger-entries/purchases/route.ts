import { NextRequest, NextResponse } from "next/server";
import { postDocument, DuplicateDocumentError, UnbalancedEntryError } from "@/lib/ledgerPosting";
import { resolvePoster } from "@/lib/currentUser";
import { logAudit, getClientIp } from "@/lib/audit";
import {
  expandVatLines,
  counterpartyFields,
  flipLines,
  MissingPostingAccountError,
  type ExpandInputLine,
} from "@/lib/vatLineExpansion";
import { firstSpecialCharError } from "@/lib/textValidation";
import type { CounterpartyType } from "@prisma/client";

type RequestBody = {
  companyId: string;
  locationId?: string | null;
  documentNo: string; // PV no., or CM no. when isReturn
  postingDate: string;
  isReturn?: boolean;
  counterpartyType?: CounterpartyType | null; // normally VENDOR
  counterpartyId?: string | null;
  payableAccountId: string;
  particulars?: string | null;
  lines: ExpandInputLine[];
};

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as RequestBody | null;
  if (!body) return NextResponse.json({ error: "Invalid request body" }, { status: 400 });

  const { companyId, documentNo, payableAccountId, postingDate, lines } = body;
  const textErr = firstSpecialCharError({ "Document no.": documentNo, Particulars: body.particulars });
  if (textErr) return NextResponse.json({ error: textErr }, { status: 400 });
  if (!companyId || !documentNo || !payableAccountId || !postingDate || !lines?.length) {
    return NextResponse.json(
      { error: "companyId, documentNo, payableAccountId, postingDate, and at least one line are required" },
      { status: 400 }
    );
  }

  const auth = await resolvePoster(companyId, "canPost");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const counterparty = counterpartyFields(body.counterpartyType ?? "VENDOR", body.counterpartyId);
  let glLines, payableAmount: number;

  try {
    // DEBIT direction: same as Cash Disbursement — Purchases/Input VAT
    // are debited, withholding companion is a credit (liability).
    const result = await expandVatLines(companyId, lines, "DEBIT", counterparty, body.particulars, documentNo);
    glLines = result.glLines;
    payableAmount = result.balancingAmount;
  } catch (err) {
    if (err instanceof MissingPostingAccountError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }

  if (payableAmount <= 0) {
    return NextResponse.json(
      { error: "Computed payable amount is zero or negative — check the line amounts." },
      { status: 400 }
    );
  }

  // Balancing line: no cash moves yet — the amount owed (net of any
  // withholding pre-recorded) becomes a payable, settled later via a
  // Cash Disbursement entry against this same vendor.
  glLines.push({
    accountId: payableAccountId,
    creditAmount: payableAmount,
    description: body.particulars ?? null,
    ...counterparty,
  });

  // A Purchase Return is the same entry, reversed — not a separate rule set.
  const finalLines = body.isReturn ? flipLines(glLines) : glLines;

  try {
    const created = await postDocument({
      companyId,
      locationId: body.locationId ?? null,
      journalType: "PURCHASE_ON_ACCOUNT",
      documentType: body.isReturn ? "CREDIT_MEMO" : "PURCHASE",
      documentNo,
      postingDate: new Date(postingDate),
      isReturn: body.isReturn ?? false,
      lines: finalLines,
      createdById: auth.user.id,
      isApproved: auth.capability.canApprove,
    });
    await logAudit({
      companyId,
      username: auth.user.email,
      action: `Posted ${body.isReturn ? "Purchase Return" : "Purchase"} ${documentNo}`,
      ipAddress: getClientIp(request),
    });
    return NextResponse.json({ entries: created, payableAmount }, { status: 201 });
  } catch (err) {
    if (err instanceof UnbalancedEntryError || err instanceof DuplicateDocumentError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }
}
