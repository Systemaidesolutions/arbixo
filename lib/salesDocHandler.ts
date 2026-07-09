import { NextRequest, NextResponse } from "next/server";
import { poster } from "@/lib/purchaseDocs";
import { saveSalesDraft, type SalesDocInput } from "@/lib/salesDocs";
import { postSalesDoc, SalesDocError } from "@/lib/salesDocPosting";
import { DuplicateDocumentError, UnbalancedEntryError } from "@/lib/ledgerPosting";
import { MissingPostingAccountError } from "@/lib/vatLineExpansion";
import { logAudit, getClientIp } from "@/lib/audit";

// Create/update a Sales Order. `post: true` posts it after saving; otherwise it
// stays a DRAFT. Shared by POST (create) and PATCH (edit).
export async function saveSalesDoc(request: NextRequest, id: string | null) {
  const p = await poster();
  if (!p) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = ((await request.json().catch(() => null)) ?? {}) as SalesDocInput & { post?: boolean };
  const saved = await saveSalesDraft(p.companyId, p.userId, id, body);
  if (saved.error || !saved.id) return NextResponse.json({ error: saved.error }, { status: saved.status });

  if (!body.post) return NextResponse.json({ id: saved.id, status: "DRAFT" });

  try {
    await postSalesDoc(p.companyId, saved.id, p.userId, p.canApprove);
    await logAudit({ companyId: p.companyId, username: p.email, action: `Posted Sales Order ${(body.transactionNo ?? "").trim()}`, ipAddress: getClientIp(request) });
    return NextResponse.json({ id: saved.id, status: "POSTED" });
  } catch (err) {
    const known = err instanceof SalesDocError || err instanceof MissingPostingAccountError || err instanceof UnbalancedEntryError || err instanceof DuplicateDocumentError;
    return NextResponse.json({ id: saved.id, status: "DRAFT", error: known ? (err as Error).message : "Could not post the document." }, { status: 400 });
  }
}
