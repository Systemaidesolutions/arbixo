import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateNameFields } from "@/lib/partyValidation";
import type { CustomerType, RegistrationType, TaxClassification } from "@prisma/client";

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const customer = await prisma.customer.findUnique({ where: { id: params.id } });
  if (!customer) return NextResponse.json({ error: "Customer not found" }, { status: 404 });
  return NextResponse.json({ customer });
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const existing = await prisma.customer.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: "Customer not found" }, { status: 404 });

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid request body" }, { status: 400 });

  const nameError = validateNameFields(body);
  if (nameError) return NextResponse.json({ error: nameError }, { status: 400 });

  if (body.code && body.code !== existing.code) {
    const duplicate = await prisma.customer.findUnique({
      where: { companyId_code: { companyId: existing.companyId, code: body.code } },
    });
    if (duplicate) {
      return NextResponse.json({ error: `Customer code "${body.code}" is already in use` }, { status: 409 });
    }
  }

  const customer = await prisma.customer.update({
    where: { id: params.id },
    data: {
      code: body.code ?? undefined,
      tin: body.tin ?? undefined,
      taxClassification: (body.taxClassification as TaxClassification) ?? undefined,
      registeredName: body.registeredName ?? undefined,
      lastName: body.lastName ?? undefined,
      firstName: body.firstName ?? undefined,
      middleName: body.middleName ?? undefined,
      tradeName: body.tradeName ?? undefined,
      customerType: (body.customerType as CustomerType) ?? undefined,
      registrationType: (body.registrationType as RegistrationType) ?? undefined,
      paymentTerms: body.paymentTerms === undefined ? undefined : body.paymentTerms,
      authorizedRep: body.authorizedRep ?? undefined,
      address: body.address ?? undefined,
      barangay: body.barangay ?? undefined,
      city: body.city ?? undefined,
      province: body.province ?? undefined,
      zipCode: body.zipCode ?? undefined,
      telNo: body.telNo ?? undefined,
      faxNo: body.faxNo ?? undefined,
      cellNo: body.cellNo ?? undefined,
      email: body.email ?? undefined,
      website: body.website ?? undefined,
      isActive: typeof body.isActive === "boolean" ? body.isActive : undefined,
    },
  });

  return NextResponse.json({ customer });
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  const entryCount = await prisma.ledgerEntry.count({ where: { customerId: params.id } });
  if (entryCount > 0) {
    return NextResponse.json(
      { error: "This customer has posted ledger entries and can't be deleted. Deactivate it instead." },
      { status: 409 }
    );
  }
  await prisma.customer.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
