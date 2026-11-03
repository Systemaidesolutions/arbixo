import { NextRequest, NextResponse } from "next/server";
import { UnbalancedEntryError, DuplicateDocumentError } from "@/lib/ledgerPosting";
import { payrollAuth, postRun } from "@/lib/payroll/server";

export async function POST(_request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await payrollAuth();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  try {
    const r = await postRun(auth.companyId, auth.userId, params.id);
    return NextResponse.json(r.error ? { error: r.error } : { ok: true }, { status: r.status });
  } catch (e) {
    if (e instanceof UnbalancedEntryError || e instanceof DuplicateDocumentError) return NextResponse.json({ error: e.message }, { status: 400 });
    throw e;
  }
}
