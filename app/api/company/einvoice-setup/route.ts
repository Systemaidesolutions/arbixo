import { NextRequest, NextResponse } from "next/server";
import { getCurrentCompany, getCurrentCapability } from "@/lib/currentUser";
import { prisma } from "@/lib/prisma";

// This company's own e-invoice settings (lib/salesInvoice.ts) — the ATP
// details printed on the invoice footer and the next invoice number, same
// shape as the platform-wide ARbixo business profile settings but scoped to
// the caller's own company.
export async function GET() {
  const company = await getCurrentCompany();
  if (!company) return NextResponse.json({ error: "No company." }, { status: 403 });

  return NextResponse.json({
    atpNumber: company.atpNumber ?? "",
    atpSeriesFrom: company.atpSeriesFrom ?? "",
    atpSeriesTo: company.atpSeriesTo ?? "",
    atpValidUntil: company.atpValidUntil ? company.atpValidUntil.toISOString().slice(0, 10) : "",
    nextInvoiceNo: company.nextInvoiceNo,
  });
}

export async function PATCH(request: NextRequest) {
  const company = await getCurrentCompany();
  if (!company) return NextResponse.json({ error: "No company." }, { status: 403 });

  const capability = await getCurrentCapability();
  if (!capability || capability.isReadOnly) {
    return NextResponse.json({ error: "You don't have permission to change these settings." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid request body." }, { status: 400 });

  const data: { atpNumber?: string | null; atpSeriesFrom?: string | null; atpSeriesTo?: string | null; atpValidUntil?: Date | null } = {};
  for (const f of ["atpNumber", "atpSeriesFrom", "atpSeriesTo"] as const) {
    if (typeof body[f] === "string") data[f] = body[f].trim() || null;
  }
  if (typeof body.atpValidUntil === "string") {
    data.atpValidUntil = body.atpValidUntil ? new Date(`${body.atpValidUntil}T00:00:00Z`) : null;
  }

  await prisma.company.update({ where: { id: company.id }, data });
  return NextResponse.json({ ok: true });
}
