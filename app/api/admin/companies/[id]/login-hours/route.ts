import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminUser } from "@/lib/currentUser";
import { isValidHHMM } from "@/lib/loginHours";

// Admin sets a company's allowed login hours (PH time). Outside them, the
// company's users must sign in with two-factor. See lib/loginHours.ts.
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json().catch(() => null);
  const enabled = body?.loginHoursEnabled === true;
  const start = body?.loginStart;
  const end = body?.loginEnd;
  const days: number[] = Array.isArray(body?.loginDays)
    ? [...new Set<number>(body.loginDays.filter((d: unknown) => Number.isInteger(d) && (d as number) >= 0 && (d as number) <= 6))].sort()
    : [];

  if (!isValidHHMM(start) || !isValidHHMM(end)) {
    return NextResponse.json({ error: "Enter a valid start and end time." }, { status: 400 });
  }
  if (enabled && days.length === 0) {
    return NextResponse.json({ error: "Tick at least one allowed day." }, { status: 400 });
  }

  const company = await prisma.company.findUnique({ where: { id: params.id }, select: { id: true } });
  if (!company) return NextResponse.json({ error: "Company not found" }, { status: 404 });

  const saved = await prisma.company.update({
    where: { id: params.id },
    data: { loginHoursEnabled: enabled, loginStart: start, loginEnd: end, loginDays: days },
    select: { loginHoursEnabled: true, loginStart: true, loginEnd: true, loginDays: true },
  });
  return NextResponse.json({ ok: true, company: saved });
}
