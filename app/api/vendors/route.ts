import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateNameFields } from "@/lib/partyValidation";
import type { RegistrationType, TaxClassification, VendorType } from "@prisma/client";

export async function GET(request: NextRequest) {
  const companyId = request.nextUrl.searchParams.get("companyId");
  if (!companyId) {
    return NextResponse.json({ error: "companyId query parameter is required" }, { status: 400 });
  }
  const vendors = await prisma.vendor.findMany({
    where: { companyId },
    orderBy: { code: "asc" },
  });
  return NextResponse.json({ vendors });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid request body" }, { status: 400 });

  const { companyId, code, vendorType, registrationType } = body;
  if (!companyId || !code || !vendorType || !registrationType) {
    return NextResponse.json(
      { error: "companyId, code, vendorType, and registrationType are required" },
      { status: 400 }
    );
  }

  const nameError = validateNameFields(body);
  if (nameError) return NextResponse.json({ error: nameError }, { status: 400 });

  const duplicate = await prisma.vendor.findUnique({
    where: { companyId_code: { companyId, code } },
  });
  if (duplicate) {
    return NextResponse.json({ error: `Vendor code "${code}" is already in use` }, { status: 409 });
  }

  const vendor = await prisma.vendor.create({
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
      vendorType: vendorType as VendorType,
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

  return NextResponse.json({ vendor }, { status: 201 });
}
