import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserRecord } from "@/lib/currentUser";
import { capabilitiesFor } from "@/lib/permissions";
import { DEFAULT_CHART_OF_ACCOUNTS } from "@/lib/defaultChartOfAccounts";

// Seeds the standard chart of accounts into the caller's company — only when
// it has none yet (new companies already get it at creation; this covers
// companies created before that, or ones started from an empty chart).
export async function POST() {
  const user = await getCurrentUserRecord();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  if (user.role !== "USER" || !user.companyId) {
    return NextResponse.json({ error: "Only a company account can load accounts." }, { status: 403 });
  }
  if (!capabilitiesFor(user.role, user.subscriberSubtype).canPost) {
    return NextResponse.json({ error: "Your account is read-only." }, { status: 403 });
  }

  const existing = await prisma.account.count({ where: { companyId: user.companyId } });
  if (existing > 0) {
    return NextResponse.json(
      { error: "This company already has a chart of accounts." },
      { status: 409 }
    );
  }

  await prisma.account.createMany({
    data: DEFAULT_CHART_OF_ACCOUNTS.map((a) => ({ ...a, companyId: user.companyId! })),
  });

  return NextResponse.json({ ok: true, created: DEFAULT_CHART_OF_ACCOUNTS.length });
}
