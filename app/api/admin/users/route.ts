import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminUser } from "@/lib/currentUser";
import { hashPassword } from "@/lib/password";
import type { SubscriberSubtype, UserRole } from "@prisma/client";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SUBTYPES: SubscriberSubtype[] = ["MANAGER", "USER", "REPORT_CREATOR"];

// Admin creates a user directly (pre-verified). User Type is Admin or
// Subscriber; a Subscriber must have a subtype, and may optionally be
// assigned a company.
export async function POST(request: NextRequest) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await request.json().catch(() => null)) as
    | {
        email?: string;
        password?: string;
        role?: UserRole;
        subscriberSubtype?: SubscriberSubtype | null;
        companyId?: string | null;
      }
    | null;
  if (!body) return NextResponse.json({ error: "Invalid request body" }, { status: 400 });

  const email = body.email?.trim().toLowerCase();
  const password = body.password;
  const role: UserRole = body.role === "ADMIN" ? "ADMIN" : "USER";

  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }
  if (!password || password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  }

  let subscriberSubtype: SubscriberSubtype | null = null;
  let companyId: string | null = null;

  if (role === "USER") {
    if (!body.subscriberSubtype || !SUBTYPES.includes(body.subscriberSubtype)) {
      return NextResponse.json(
        { error: "A subscriber requires a subtype (Manager, User, or Report Creator)." },
        { status: 400 }
      );
    }
    subscriberSubtype = body.subscriberSubtype;

    if (body.companyId) {
      const company = await prisma.company.findUnique({ where: { id: body.companyId } });
      if (!company) return NextResponse.json({ error: "Company not found." }, { status: 404 });
      companyId = company.id;
    }
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "A user with that email already exists." }, { status: 409 });
  }

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      role,
      subscriberSubtype,
      companyId,
      isVerified: true, // admin-created accounts skip email verification
    },
  });

  return NextResponse.json(
    { user: { id: user.id, email: user.email, role: user.role, subscriberSubtype: user.subscriberSubtype } },
    { status: 201 }
  );
}
