import { NextRequest, NextResponse } from "next/server";
import { DuplicateDocumentError, UnbalancedEntryError } from "@/lib/ledgerPosting";
import { resolvePoster } from "@/lib/currentUser";
import { logAudit, getClientIp } from "@/lib/audit";
import { MissingPostingAccountError, type ExpandInputLine } from "@/lib/vatLineExpansion";
import { postVatJournal, ZeroBalanceError } from "@/lib/vatJournals";
import { saveAttachments, type AttachmentInput } from "@/lib/transactionAttachments";
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
  paymentTerms?: string | null;
  dueDate?: string | null;
  lines: ExpandInputLine[];
  attachments?: AttachmentInput[];
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

  try {
    const created = await postVatJournal(
      companyId,
      "PURCHASE_ON_ACCOUNT",
      {
        locationId: body.locationId ?? null,
        documentNo,
        postingDate: new Date(postingDate),
        counterpartyType: body.counterpartyType ?? "VENDOR",
        counterpartyId: body.counterpartyId ?? null,
        balancingAccountId: payableAccountId,
        particulars: body.particulars ?? null,
        paymentTerms: body.paymentTerms ?? null,
        dueDate: body.dueDate ?? null,
        isReturn: body.isReturn ?? false,
        lines,
      },
      auth.user.id,
      auth.capability.canApprove
    );
    if (body.attachments?.length) {
      await saveAttachments(companyId, "PURCHASE_ON_ACCOUNT", documentNo, body.attachments, auth.user.id);
    }
    await logAudit({
      companyId,
      username: auth.user.email,
      action: `Posted ${body.isReturn ? "Purchase Return" : "Purchase"} ${documentNo}`,
      ipAddress: getClientIp(request),
    });
    return NextResponse.json({ entries: created }, { status: 201 });
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
