import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { DuplicateDocumentError, UnbalancedEntryError } from "@/lib/ledgerPosting";
import { resolvePoster } from "@/lib/currentUser";
import { logAudit, getClientIp } from "@/lib/audit";
import { MissingPostingAccountError, type ExpandInputLine } from "@/lib/vatLineExpansion";
import { postVatJournal, ZeroBalanceError } from "@/lib/vatJournals";
import { saveAttachments, type AttachmentInput } from "@/lib/transactionAttachments";
import { firstSpecialCharError } from "@/lib/textValidation";
import {
  recordPayableApplications,
  assertApplicationsMatchApLines,
  ApplicationOverLimitError,
  ApplicationMismatchError,
  type ApplicationInput,
} from "@/lib/payableApplications";
import type { CounterpartyType } from "@prisma/client";

type RequestBody = {
  companyId: string;
  locationId?: string | null;
  documentNo: string;
  checkNo?: string | null;
  postingDate: string;
  counterpartyType?: CounterpartyType | null;
  counterpartyId?: string | null;
  cashAccountId: string;
  particulars?: string | null;
  paymentTerms?: string | null;
  dueDate?: string | null;
  lines: ExpandInputLine[];
  attachments?: AttachmentInput[];
  // Which posted Purchase on Account bill(s) this disbursement pays off, and
  // how much applies to each — only meaningful when counterpartyType is
  // VENDOR. Optional: a disbursement can also just be an on-account payment
  // with nothing applied yet. Mirrors the AR "applications" field.
  applications?: ApplicationInput[];
};

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as RequestBody | null;
  if (!body) return NextResponse.json({ error: "Invalid request body" }, { status: 400 });

  const { companyId, documentNo, cashAccountId, postingDate, lines } = body;
  const textErr = firstSpecialCharError({ "Document no.": documentNo, "Check no.": body.checkNo, Particulars: body.particulars });
  if (textErr) return NextResponse.json({ error: textErr }, { status: 400 });
  if (!companyId || !documentNo || !cashAccountId || !postingDate || !lines?.length) {
    return NextResponse.json(
      { error: "companyId, documentNo, cashAccountId, postingDate, and at least one line are required" },
      { status: 400 }
    );
  }

  const auth = await resolvePoster(companyId, "canPost");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  if (body.counterpartyType === "VENDOR" && body.applications?.length) {
    const apAccounts = await prisma.account.findMany({
      where: { id: { in: lines.map((l) => l.accountId) }, classification: "ACCOUNTS_PAYABLE" },
      select: { id: true },
    });
    const apAccountIds = new Set(apAccounts.map((a) => a.id));
    const apLineTotal = lines.filter((l) => apAccountIds.has(l.accountId)).reduce((s, l) => s + l.amount, 0);
    try {
      await assertApplicationsMatchApLines(apLineTotal, body.applications);
    } catch (err) {
      if (err instanceof ApplicationMismatchError) return NextResponse.json({ error: err.message }, { status: 400 });
      throw err;
    }
  }

  try {
    const created = await postVatJournal(
      companyId,
      "CASH_DISBURSEMENT",
      {
        locationId: body.locationId ?? null,
        documentNo,
        checkNo: body.checkNo ?? null,
        postingDate: new Date(postingDate),
        counterpartyType: body.counterpartyType ?? null,
        counterpartyId: body.counterpartyId ?? null,
        balancingAccountId: cashAccountId,
        particulars: body.particulars ?? null,
        paymentTerms: body.paymentTerms ?? null,
        dueDate: body.dueDate ?? null,
        lines,
      },
      auth.user.id
    );
    if (body.attachments?.length) {
      await saveAttachments(companyId, "CASH_DISBURSEMENT", documentNo, body.attachments, auth.user.id);
    }

    let applicationError: string | null = null;
    if (body.counterpartyType === "VENDOR" && body.counterpartyId && body.applications?.length) {
      try {
        await recordPayableApplications(companyId, body.counterpartyId, documentNo, body.applications, auth.user.id);
      } catch (err) {
        // The disbursement itself already posted successfully at this point —
        // don't fail the whole request (that would read as "nothing
        // happened" and invite a duplicate post). Surface it as a warning.
        applicationError =
          err instanceof ApplicationOverLimitError
            ? `Posted, but couldn't record the bill application: ${err.message}`
            : "Posted, but couldn't record which bill(s) this payment applies to.";
      }
    }

    await logAudit({
      companyId,
      username: auth.user.email,
      action: `Posted Cash Disbursement ${documentNo}`,
      ipAddress: getClientIp(request),
    });
    return NextResponse.json({ entries: created, applicationError }, { status: 201 });
  } catch (err) {
    if (
      err instanceof MissingPostingAccountError ||
      err instanceof ZeroBalanceError ||
      err instanceof UnbalancedEntryError ||
      err instanceof DuplicateDocumentError
    ) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }
}
