import { NextRequest, NextResponse } from "next/server";
import { getCurrentCompany, getCurrentCapability } from "@/lib/currentUser";
import { prisma } from "@/lib/prisma";
import { ensureDefaultSeries } from "@/lib/numberSeriesServer";
import { NUMBER_SERIES, PREFIX_PATTERN, SERIES_PADDING } from "@/lib/numberSeries";

// Returns the caller company's No. Series (creating defaults on first read).
export async function GET() {
  const company = await getCurrentCompany();
  if (!company) return NextResponse.json({ error: "No company." }, { status: 403 });

  const series = await ensureDefaultSeries(company.id);
  return NextResponse.json({ series, padding: SERIES_PADDING });
}

// Updates the prefixes. Only the prefix is editable — the running number is
// managed by the system.
export async function PATCH(request: NextRequest) {
  const company = await getCurrentCompany();
  if (!company) return NextResponse.json({ error: "No company." }, { status: 403 });

  const capability = await getCurrentCapability();
  if (!capability || capability.isReadOnly) {
    return NextResponse.json({ error: "You don't have permission to change these settings." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const updates = body?.series;
  if (!Array.isArray(updates)) {
    return NextResponse.json({ error: "A 'series' array is required." }, { status: 400 });
  }

  await ensureDefaultSeries(company.id);
  const valid = new Set(NUMBER_SERIES.map((s) => s.entityType as string));

  for (const u of updates) {
    if (!valid.has(u?.entityType)) continue;
    const prefix = String(u.prefix ?? "").trim().toUpperCase();
    if (!PREFIX_PATTERN.test(prefix)) {
      return NextResponse.json(
        { error: `Prefix "${u.prefix}" is invalid. Use 1–10 letters, digits or hyphen.` },
        { status: 400 }
      );
    }
    await prisma.numberSeries.update({
      where: { companyId_entityType: { companyId: company.id, entityType: u.entityType } },
      data: { prefix },
    });
  }

  const series = await ensureDefaultSeries(company.id);
  return NextResponse.json({ series });
}
