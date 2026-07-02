import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminUser } from "@/lib/currentUser";
import type { Prisma, SubscriberSubtype, UserRole } from "@prisma/client";

const SUBTYPES: SubscriberSubtype[] = ["MANAGER", "USER", "REPORT_CREATOR"];

// Admin actions on a single user: toggle disabled, bypass email
// verification, change user type / subtype, and/or (re)assign the company.
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await request.json().catch(() => null)) as
    | {
        isDisabled?: boolean;
        isVerified?: boolean;
        companyId?: string | null;
        role?: UserRole;
        subscriberSubtype?: SubscriberSubtype | null;
      }
    | null;
  if (!body) return NextResponse.json({ error: "Invalid request body" }, { status: 400 });

  const target = await prisma.user.findUnique({ where: { id: params.id } });
  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // Guard against an admin locking themselves out of their own account.
  if (target.id === admin.id && body.isDisabled === true) {
    return NextResponse.json({ error: "You can't disable your own account." }, { status: 400 });
  }

  const data: Prisma.UserUpdateInput = {};

  if (typeof body.isDisabled === "boolean") data.isDisabled = body.isDisabled;
  if (body.isVerified === true) {
    data.isVerified = true;
    data.verificationCode = null;
    data.verificationExpiresAt = null;
  }

  // User Type change. Switching to ADMIN clears the (subscriber-only)
  // subtype and company; switching to USER requires a subtype.
  let finalRole: UserRole = target.role;
  if (body.role !== undefined) {
    if (body.role !== "ADMIN" && body.role !== "USER") {
      return NextResponse.json({ error: "Invalid user type." }, { status: 400 });
    }
    if (target.id === admin.id && body.role !== "ADMIN") {
      return NextResponse.json({ error: "You can't change your own account type." }, { status: 400 });
    }
    finalRole = body.role;
    data.role = body.role;
    if (body.role === "ADMIN") {
      data.subscriberSubtype = null;
      data.company = { disconnect: true };
    }
  }

  // Subscriber subtype.
  if (finalRole === "USER" && body.subscriberSubtype !== undefined && body.subscriberSubtype !== null) {
    if (!SUBTYPES.includes(body.subscriberSubtype)) {
      return NextResponse.json({ error: "Invalid subscriber subtype." }, { status: 400 });
    }
    data.subscriberSubtype = body.subscriberSubtype;
  }

  // If the account is (or becomes) a subscriber, it must end up with a subtype.
  if (finalRole === "USER") {
    const resultingSubtype =
      (data.subscriberSubtype as SubscriberSubtype | null | undefined) ?? target.subscriberSubtype;
    if (!resultingSubtype) {
      return NextResponse.json(
        { error: "A subscriber must have a subtype (Manager, User, or Report Creator)." },
        { status: 400 }
      );
    }
  }

  // Company assignment. A user belongs to at most one company; a company
  // can have many users. Passing companyId:null unassigns.
  if (body.companyId !== undefined && data.role !== "ADMIN") {
    if (finalRole !== "USER") {
      return NextResponse.json(
        { error: "Only subscriber (USER) accounts can be assigned to a company." },
        { status: 400 }
      );
    }
    if (body.companyId) {
      const company = await prisma.company.findUnique({ where: { id: body.companyId } });
      if (!company) return NextResponse.json({ error: "Company not found" }, { status: 404 });
      data.company = { connect: { id: company.id } };
    } else {
      data.company = { disconnect: true };
    }
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const user = await prisma.user.update({ where: { id: target.id }, data });
  return NextResponse.json({
    user: {
      id: user.id,
      role: user.role,
      subscriberSubtype: user.subscriberSubtype,
      isDisabled: user.isDisabled,
      isVerified: user.isVerified,
      companyId: user.companyId,
    },
  });
}

// Delete a user — only allowed when no accounting transactions exist for
// their company. Once a company has posted even one ledger entry, its
// users can't be deleted (the audit trail must stay attributable).
export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const target = await prisma.user.findUnique({ where: { id: params.id } });
  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });

  if (target.id === admin.id) {
    return NextResponse.json({ error: "You can't delete your own account." }, { status: 400 });
  }

  if (target.companyId) {
    const txCount = await prisma.ledgerEntry.count({ where: { companyId: target.companyId } });
    if (txCount > 0) {
      return NextResponse.json(
        {
          error: `This user's company has ${txCount} posted transaction(s), so the account can't be deleted. Disable it instead.`,
        },
        { status: 409 }
      );
    }
  }

  await prisma.user.delete({ where: { id: target.id } });
  return NextResponse.json({ ok: true });
}
