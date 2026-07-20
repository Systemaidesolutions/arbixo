import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateEmployeeText } from "@/lib/partyValidation";

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const employee = await prisma.employee.findUnique({ where: { id: params.id } });
  if (!employee) return NextResponse.json({ error: "Employee not found" }, { status: 404 });
  return NextResponse.json({ employee });
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const existing = await prisma.employee.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: "Employee not found" }, { status: 404 });

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid request body" }, { status: 400 });

  if ((body.lastName !== undefined && !body.lastName?.trim()) ||
      (body.firstName !== undefined && !body.firstName?.trim())) {
    return NextResponse.json({ error: "Last name and first name can't be blank" }, { status: 400 });
  }

  const specialErr = validateEmployeeText(body);
  if (specialErr) return NextResponse.json({ error: specialErr }, { status: 400 });

  if (body.code && body.code !== existing.code) {
    const duplicate = await prisma.employee.findUnique({
      where: { companyId_code: { companyId: existing.companyId, code: body.code } },
    });
    if (duplicate) {
      return NextResponse.json({ error: `Employee code "${body.code}" is already in use` }, { status: 409 });
    }
  }

  const employee = await prisma.employee.update({
    where: { id: params.id },
    data: {
      code: body.code ?? undefined,
      tin: body.tin ?? undefined,
      lastName: body.lastName ?? undefined,
      firstName: body.firstName ?? undefined,
      middleName: body.middleName ?? undefined,
      position: body.position ?? undefined,
      address: body.address ?? undefined,
      barangay: body.barangay ?? undefined,
      district: body.district ?? undefined,
      city: body.city ?? undefined,
      province: body.province ?? undefined,
      zipCode: body.zipCode ?? undefined,
      telNo: body.telNo ?? undefined,
      cellNo: body.cellNo ?? undefined,
      email: body.email ?? undefined,
      isActive: typeof body.isActive === "boolean" ? body.isActive : undefined,
    },
  });

  return NextResponse.json({ employee });
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  const entryCount = await prisma.ledgerEntry.count({ where: { employeeId: params.id } });
  if (entryCount > 0) {
    return NextResponse.json(
      { error: "This employee has posted ledger entries and can't be deleted. Deactivate it instead." },
      { status: 409 }
    );
  }
  await prisma.employee.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
