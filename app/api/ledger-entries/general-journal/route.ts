import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { computeWithholding } from "@/lib/vat";
import { postDocument, DuplicateDocumentError, UnbalancedEntryError, type LedgerLineInput } from "@/lib/ledgerPosting";
import { resolvePoster } from "@/lib/currentUser";
import { logAudit, getClientIp } from "@/lib/audit";
import { counterpartyFields } from "@/lib/vatLineExpansion";
import { saveAttachments, type AttachmentInput } from "@/lib/transactionAttachments";
import { firstSpecialCharError } from "@/lib/textValidation";
import type { CounterpartyType, VatType } from "@prisma/client";

type InputLine = {
  accountId: string;
  debitAmount?: number;
  creditAmount?: number;
  description?: string | null;
  referenceNo?: string | null;
  counterpartyType?: CounterpartyType | null;
  counterpartyId?: string | null;
  // Purely informational tagging for BIR reporting (Summary Lists, VAT
  // returns) — unlike the other four journals, nothing here triggers an
  // automatic companion line. If a General Journal entry needs an Input
  // VAT or Withholding Payable line, the user adds it as its own line,
  // same as any other account. This is deliberate: the manual's own VAT
  // closing entries (Input/Output → VAT Payable) require declining the
  // VAT-computation prompt entirely, which only makes sense if the
  // journal doesn't force it.
  vatType?: VatType | null;
  grossAmount?: number | null;
  netAmount?: number | null;
  vatAmount?: number | null;
  atcCodeId?: string | null;
};

type RequestBody = {
  companyId: string;
  locationId?: string | null;
  documentNo: string; // JV no.
  postingDate: string;
  particulars?: string | null;
  dueDate?: string | null;
  lines: InputLine[];
  attachments?: AttachmentInput[];
};

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as RequestBody | null;
  if (!body) return NextResponse.json({ error: "Invalid request body" }, { status: 400 });

  const { companyId, documentNo, postingDate, lines } = body;
  const textErr = firstSpecialCharError({ "Document no.": documentNo, Particulars: body.particulars });
  if (textErr) return NextResponse.json({ error: textErr }, { status: 400 });
  if (!companyId || !documentNo || !postingDate || !lines || lines.length < 2) {
    return NextResponse.json(
      { error: "companyId, documentNo, postingDate, and at least two lines are required" },
      { status: 400 }
    );
  }

  const auth = await resolvePoster(companyId, "canPost");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  for (const line of lines) {
    if (!line.accountId) {
      return NextResponse.json({ error: "Every line needs an account" }, { status: 400 });
    }
    const debit = line.debitAmount ?? 0;
    const credit = line.creditAmount ?? 0;
    if (debit > 0 && credit > 0) {
      return NextResponse.json(
        { error: "A line can't have both a debit and a credit amount" },
        { status: 400 }
      );
    }
    if (debit === 0 && credit === 0) {
      return NextResponse.json({ error: "Every line needs a debit or credit amount" }, { status: 400 });
    }
  }

  const atcCodeIds = [...new Set(lines.map((l) => l.atcCodeId).filter(Boolean))] as string[];
  const atcCodes = atcCodeIds.length
    ? await prisma.atcCode.findMany({ where: { id: { in: atcCodeIds } } })
    : [];
  const atcById = new Map(atcCodes.map((a) => [a.id, a]));

  const glLines: LedgerLineInput[] = lines.map((line) => {
    const atc = line.atcCodeId ? atcById.get(line.atcCodeId) : null;
    const withholdingAmt =
      atc && line.netAmount != null ? computeWithholding(line.netAmount, Number(atc.ratePercent)) : null;

    return {
      accountId: line.accountId,
      debitAmount: line.debitAmount ?? 0,
      creditAmount: line.creditAmount ?? 0,
      description: body.particulars ?? null,
      lineDescription: line.description ?? null,
      referenceNo: line.referenceNo ?? null,
      dueDate: body.dueDate ?? null,
      ...counterpartyFields(line.counterpartyType, line.counterpartyId),
      vatType: line.vatType ?? null,
      grossAmount: line.grossAmount ?? null,
      netAmount: line.netAmount ?? null,
      vatAmount: line.vatAmount ?? null,
      atcCode: atc?.code ?? null,
      atcDescription: atc?.description ?? null,
      withholdingAmt,
    };
  });

  try {
    const created = await postDocument({
      companyId,
      locationId: body.locationId ?? null,
      journalType: "GENERAL_JOURNAL",
      documentType: "JOURNAL",
      documentNo,
      postingDate: new Date(postingDate),
      lines: glLines,
      createdById: auth.user.id,
      isApproved: auth.capability.canApprove,
    });
    if (body.attachments?.length) {
      await saveAttachments(companyId, "GENERAL_JOURNAL", documentNo, body.attachments, auth.user.id);
    }
    await logAudit({
      companyId,
      username: auth.user.email,
      action: `Posted General Journal ${documentNo}`,
      ipAddress: getClientIp(request),
    });
    return NextResponse.json({ entries: created }, { status: 201 });
  } catch (err) {
    if (err instanceof UnbalancedEntryError || err instanceof DuplicateDocumentError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }
}
