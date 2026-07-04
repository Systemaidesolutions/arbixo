import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentCompany, resolvePoster } from "@/lib/currentUser";
import { firstSpecialCharError } from "@/lib/textValidation";

function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

// Lists the current company's importations (newest import date first).
export async function GET() {
  const company = await getCurrentCompany();
  if (!company) return NextResponse.json({ error: "No company." }, { status: 403 });
  const importations = await prisma.importation.findMany({
    where: { companyId: company.id },
    orderBy: [{ importDate: "desc" }, { createdAt: "desc" }],
  });
  return NextResponse.json({ importations });
}

// Records a new importation for the caller's company.
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid request body" }, { status: 400 });

  const { companyId, sellerName, countryOrigin, orNo } = body;
  const textErr = firstSpecialCharError({
    "Name of seller": sellerName,
    "Country of origin": countryOrigin,
    "OR no.": orNo,
  });
  if (textErr) return NextResponse.json({ error: textErr }, { status: 400 });

  if (!companyId || !sellerName?.trim() || !countryOrigin?.trim() || !orNo?.trim()) {
    return NextResponse.json(
      { error: "companyId, sellerName, countryOrigin, and orNo are required" },
      { status: 400 }
    );
  }
  for (const [label, v] of [
    ["Date of importation", body.importDate],
    ["Assessment/release date", body.assessReleaseDate],
    ["Date of payment", body.paymentDate],
  ] as const) {
    if (!v) return NextResponse.json({ error: `${label} is required` }, { status: 400 });
  }

  const auth = await resolvePoster(companyId, "canPost");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const dutiableValue = round2(Number(body.dutiableValue) || 0);
  const charges = round2(Number(body.charges) || 0);
  const isVatExempt = Boolean(body.isVatExempt);
  // VAT is 12% of the dutiable + charges base when taxable; exempt importations
  // carry no VAT.
  const vatAmount = isVatExempt ? 0 : round2((dutiableValue + charges) * 0.12);

  const importation = await prisma.importation.create({
    data: {
      companyId,
      assessReleaseDate: new Date(body.assessReleaseDate),
      sellerName: sellerName.trim(),
      importDate: new Date(body.importDate),
      countryOrigin: countryOrigin.trim(),
      dutiableValue,
      charges,
      isVatExempt,
      vatAmount,
      orNo: orNo.trim(),
      paymentDate: new Date(body.paymentDate),
    },
  });

  return NextResponse.json({ importation }, { status: 201 });
}
