import { NextRequest, NextResponse } from "next/server";
import { DuplicateDocumentError, UnbalancedEntryError } from "@/lib/ledgerPosting";
import { resolvePoster } from "@/lib/currentUser";
import { logAudit, getClientIp } from "@/lib/audit";
import { MissingPostingAccountError, type ExpandInputLine } from "@/lib/vatLineExpansion";
import { postCashDisbursement, ZeroCashError } from "@/lib/cashDisbursementPosting";
import { firstSpecialCharError } from "@/lib/textValidation";
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
  lines: ExpandInputLine[];
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

  try {
    const created = await postCashDisbursement(
      companyId,
      {
        locationId: body.locationId ?? null,
        documentNo,
        checkNo: body.checkNo ?? null,
        postingDate: new Date(postingDate),
        counterpartyType: body.counterpartyType ?? null,
        counterpartyId: body.counterpartyId ?? null,
        cashAccountId,
        particulars: body.particulars ?? null,
        lines,
      },
      auth.user.id,
      auth.capability.canApprove
    );
    await logAudit({
      companyId,
      username: auth.user.email,
      action: `Posted Cash Disbursement ${documentNo}`,
      ipAddress: getClientIp(request),
    });
    return NextResponse.json({ entries: created }, { status: 201 });
  } catch (err) {
    if (
      err instanceof MissingPostingAccountError ||
      err instanceof ZeroCashError ||
      err instanceof UnbalancedEntryError ||
      err instanceof DuplicateDocumentError
    ) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }
}
