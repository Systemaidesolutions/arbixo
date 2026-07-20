import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateNameFields } from "@/lib/partyValidation";
import { nextPartyCode } from "@/lib/numberSeriesServer";
import type { RegistrationType, TaxClassification } from "@prisma/client";

export async function GET(request: NextRequest) {
  const companyId = request.nextUrl.searchParams.get("companyId");
  if (!companyId) {
    return NextResponse.json({ error: "companyId query parameter is required" }, { status: 400 });
  }
  const contacts = await prisma.contact.findMany({
    where: { companyId },
    orderBy: { code: "asc" },
  });
  return NextResponse.json({ contacts });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid request body" }, { status: 400 });

  const { companyId, registrationType } = body;
  if (!companyId || !registrationType) {
    return NextResponse.json(
      { error: "companyId and registrationType are required" },
      { status: 400 }
    );
  }

  const nameError = validateNameFields(body);
  if (nameError) return NextResponse.json({ error: nameError }, { status: 400 });

  // Code is optional: when omitted, auto-assign from the company's No. Series.
  let code: string = typeof body.code === "string" ? body.code.trim() : "";
  if (code) {
    const duplicate = await prisma.contact.findUnique({
      where: { companyId_code: { companyId, code } },
    });
    if (duplicate) {
      return NextResponse.json({ error: `Contact code "${code}" is already in use` }, { status: 409 });
    }
  } else {
    code = await nextPartyCode(companyId, "contact");
  }

  const contact = await prisma.contact.create({
    data: {
      companyId,
      code,
      tin: body.tin ?? null,
      taxClassification: body.taxClassification as TaxClassification,
      registeredName: body.registeredName ?? null,
      lastName: body.lastName ?? null,
      firstName: body.firstName ?? null,
      middleName: body.middleName ?? null,
      tradeName: body.tradeName,
      registrationType: registrationType as RegistrationType,
      address: body.address ?? null,
      barangay: body.barangay ?? null,
      district: body.district ?? null,
      city: body.city ?? null,
      province: body.province ?? null,
      zipCode: body.zipCode ?? null,
      telNo: body.telNo ?? null,
      cellNo: body.cellNo ?? null,
      email: body.email ?? null,
    },
  });

  return NextResponse.json({ contact }, { status: 201 });
}
