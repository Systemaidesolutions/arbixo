import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPortalEmployee } from "@/lib/leavePortal";
import { attachmentResponse } from "@/lib/payroll/attachmentResponse";

// A receipt the signed-in portal employee attached to their own reimbursement.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const emp = await getPortalEmployee();
  if (!emp) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
  const a = await prisma.reimbursementAttachment.findFirst({
    where: { id: params.id, reimbursement: { companyId: emp.companyId, employeeId: emp.id } },
    select: { fileName: true, contentType: true, data: true },
  });
  if (!a) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return attachmentResponse(a);
}
