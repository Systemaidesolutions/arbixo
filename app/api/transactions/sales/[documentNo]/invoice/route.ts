import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentCompany, getCurrentCapability, getCurrentUserRecord } from "@/lib/currentUser";
import { getOrCreateSalesInvoice } from "@/lib/salesInvoice";

// Generates (or returns the existing) e-invoice for one of this company's
// own posted Sales on Account documents — the "Create e-invoice" action on
// the transaction view. Idempotent: calling it again for the same document
// just returns the invoice already issued, never a second number.
export async function POST(_request: Request, { params }: { params: { documentNo: string } }) {
  const company = await getCurrentCompany();
  if (!company) return NextResponse.json({ error: "No company." }, { status: 403 });

  const capability = await getCurrentCapability();
  if (!capability || capability.isReadOnly) {
    return NextResponse.json({ error: "You don't have permission to create invoices." }, { status: 403 });
  }

  const documentNo = decodeURIComponent(params.documentNo);
  const doc = await prisma.ledgerEntry.findFirst({
    where: { companyId: company.id, journalType: "SALES_ON_ACCOUNT", documentNo },
    select: { isCancelled: true, isReturn: true },
  });
  if (!doc) return NextResponse.json({ error: "Sales on Account document not found." }, { status: 404 });
  if (doc.isCancelled) return NextResponse.json({ error: "This document is cancelled." }, { status: 400 });
  if (doc.isReturn) return NextResponse.json({ error: "Credit memos (returns) can't be invoiced." }, { status: 400 });

  const user = await getCurrentUserRecord();
  const result = await getOrCreateSalesInvoice(company.id, documentNo, user?.id ?? null);
  return NextResponse.json(result);
}
