import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminUser } from "@/lib/currentUser";

const FIELDS = [
  "registeredName",
  "tradeName",
  "tin",
  "taxpayerClass",
  "address",
  "rdoCode",
  "periodType",
  "registrationType",
  "businessType",
  "lineOfBusiness",
  "telephone",
  "atpNumber",
  "atpSeriesFrom",
  "atpSeriesTo",
] as const;

// Maps the public (short) field names used by the client/settings form to
// the bizXxx-prefixed columns on AppSettings.
const COLUMN: Record<(typeof FIELDS)[number], string> = {
  registeredName: "bizRegisteredName",
  tradeName: "bizTradeName",
  tin: "bizTin",
  taxpayerClass: "bizTaxpayerClass",
  address: "bizAddress",
  rdoCode: "bizRdoCode",
  periodType: "bizPeriodType",
  registrationType: "bizRegistrationType",
  businessType: "bizBusinessType",
  lineOfBusiness: "bizLineOfBusiness",
  telephone: "bizTelephone",
  atpNumber: "atpNumber",
  atpSeriesFrom: "atpSeriesFrom",
  atpSeriesTo: "atpSeriesTo",
};

export async function GET() {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const s = await prisma.appSettings.findUnique({ where: { id: "singleton" } });
  const out: Record<string, string> = {};
  for (const f of FIELDS) out[f] = (s as unknown as Record<string, string | null>)?.[COLUMN[f]] ?? "";
  return NextResponse.json({
    ...out,
    atpValidUntil: s?.atpValidUntil ? s.atpValidUntil.toISOString().slice(0, 10) : "",
    nextInvoiceNo: s?.nextInvoiceNo ?? 1,
  });
}

export async function PUT(request: NextRequest) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: "Admins only." }, { status: 403 });

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid request body." }, { status: 400 });

  const data: Record<string, string | Date | null> = {};
  for (const f of FIELDS) {
    if (typeof body[f] === "string") data[COLUMN[f]] = body[f].trim() || null;
  }
  if (typeof body.atpValidUntil === "string") {
    data.atpValidUntil = body.atpValidUntil ? new Date(`${body.atpValidUntil}T00:00:00Z`) : null;
  }

  await prisma.appSettings.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", ...data },
    update: data,
  });
  return NextResponse.json({ ok: true });
}
