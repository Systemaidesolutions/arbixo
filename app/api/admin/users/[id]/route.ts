import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminUser } from "@/lib/currentUser";

// Toggle disabled state and/or bypass email verification. Both are admin
// actions on a single user.
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await request.json().catch(() => null)) as
    | { isDisabled?: boolean; isVerified?: boolean }
    | null;
  if (!body) return NextResponse.json({ error: "Invalid request body" }, { status: 400 });

  const target = await prisma.user.findUnique({ where: { id: params.id } });
  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // Guard against an admin locking themselves out of their own account.
  if (target.id === admin.id && body.isDisabled === true) {
    return NextResponse.json({ error: "You can't disable your own account." }, { status: 400 });
  }

  const data: { isDisabled?: boolean; isVerified?: boolean; verificationCode?: null; verificationExpiresAt?: null } = {};
  if (typeof body.isDisabled === "boolean") data.isDisabled = body.isDisabled;
  if (body.isVerified === true) {
    data.isVerified = true;
    data.verificationCode = null;
    data.verificationExpiresAt = null;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const user = await prisma.user.update({ where: { id: target.id }, data });
  return NextResponse.json({
    user: { id: user.id, isDisabled: user.isDisabled, isVerified: user.isVerified },
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
