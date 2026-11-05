import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserRecord, effectiveCompanyId } from "@/lib/currentUser";
import { resolveActiveCompanyApps } from "@/lib/userCompanyAccess";
import { attachmentResponse } from "@/lib/payroll/attachmentResponse";

// A reimbursement receipt, for payroll staff of the active company.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const me = await getCurrentUserRecord();
  if (!me) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (!(await resolveActiveCompanyApps(me)).includes("payroll")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const companyId = await effectiveCompanyId();
  if (!companyId) return NextResponse.json({ error: "No company selected." }, { status: 403 });
  const a = await prisma.reimbursementAttachment.findFirst({
    where: { id: params.id, reimbursement: { companyId } },
    select: { fileName: true, contentType: true, data: true },
  });
  if (!a) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return attachmentResponse(a);
}
