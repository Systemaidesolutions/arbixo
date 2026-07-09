import { NextRequest, NextResponse } from "next/server";
import { poster, saveDraft, type PurchaseDocInput } from "@/lib/purchaseDocs";
import { postPurchaseDoc, PurchaseDocError } from "@/lib/purchaseDocPosting";
import { DuplicateDocumentError, UnbalancedEntryError } from "@/lib/ledgerPosting";
import { MissingPostingAccountError } from "@/lib/vatLineExpansion";
import { ZeroBalanceError } from "@/lib/vatJournals";
import { logAudit, getClientIp } from "@/lib/audit";

// Create/update a Purchase on Account. `post: true` posts it after saving;
// otherwise it stays a DRAFT. Shared by POST (create) and PATCH (edit).
export async function savePurchaseDoc(request: NextRequest, id: string | null) {
  const p = await poster();
  if (!p) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = ((await request.json().catch(() => null)) ?? {}) as PurchaseDocInput & { post?: boolean };
  const saved = await saveDraft(p.companyId, p.userId, id, body);
  if (saved.error || !saved.id) return NextResponse.json({ error: saved.error }, { status: saved.status });

  if (!body.post) return NextResponse.json({ id: saved.id, status: "DRAFT" });

  try {
    await postPurchaseDoc(p.companyId, saved.id, p.userId, p.canApprove);
    await logAudit({
      companyId: p.companyId,
      username: p.email,
      action: `Posted Purchase on Account ${(body.transactionNo ?? "").trim()}`,
      ipAddress: getClientIp(request),
    });
    return NextResponse.json({ id: saved.id, status: "POSTED" });
  } catch (err) {
    const known =
      err instanceof PurchaseDocError ||
      err instanceof MissingPostingAccountError ||
      err instanceof ZeroBalanceError ||
      err instanceof UnbalancedEntryError ||
      err instanceof DuplicateDocumentError;
    return NextResponse.json(
      { id: saved.id, status: "DRAFT", error: known ? (err as Error).message : "Could not post the document." },
      { status: 400 }
    );
  }
}
