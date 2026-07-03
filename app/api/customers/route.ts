import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateNameFields } from "@/lib/partyValidation";
import type { CustomerType, RegistrationType, TaxClassification } from "@prisma/client";

export async function GET(request: NextRequest) {
  const companyId = request.nextUrl.searchParams.get("companyId");
  if (!companyId) {
    return NextResponse.json({ error: "companyId query parameter is required" }, { status: 400 });
  }
  const customers = await prisma.customer.findMany({
    where: { companyId },
    orderBy: { code: "asc" },
  });
  return NextResponse.json({ customers });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid request body" }, { status: 400 });

  const { companyId, code, customerType, registrationType } = body;
  if (!companyId || !code || !customerType || !registrationType) {
    return NextResponse.json(
      { error: "companyId, code, customerType, and registrationType are required" },
      { status: 400 }
    );
  }

  const nameError = validateNameFields(body);
  if (nameError) return NextResponse.json({ error: nameError }, { status: 400 });

  const duplicate = await prisma.customer.findUnique({
    where: { companyId_code: { companyId, code } },
  });
  if (duplicate) {
    return NextResponse.json({ error: `Customer code "${code}" is already in use` }, { status: 409 });
  }

  const customer = await prisma.customer.create({
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
      customerType: customerType as CustomerType,
      registrationType: registrationType as RegistrationType,
      authorizedRep: body.authorizedRep ?? null,
      address: body.address ?? null,
      barangay: body.barangay ?? null,
      city: body.city ?? null,
      province: body.province ?? null,
      zipCode: body.zipCode ?? null,
      telNo: body.telNo ?? null,
      faxNo: body.faxNo ?? null,
      cellNo: body.cellNo ?? null,
      email: body.email ?? null,
      website: body.website ?? null,
    },
  });

  return NextResponse.json({ customer }, { status: 201 });
}
