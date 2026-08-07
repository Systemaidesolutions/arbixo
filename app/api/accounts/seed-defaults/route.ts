import { NextResponse } from "next/server";
import { getCurrentUserRecord, effectiveCompanyId, getCurrentCapability } from "@/lib/currentUser";
import { seedDefaultChart } from "@/lib/seedChart";

// Adds the standard heading chart into the caller's company. Safe to run even
// when the chart already has accounts — codes already in use are skipped.
export async function POST() {
  const user = await getCurrentUserRecord();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const companyId = await effectiveCompanyId();
  if (!companyId) {
    return NextResponse.json({ error: "Only a company account can load accounts." }, { status: 403 });
  }
  const cap = await getCurrentCapability();
  if (!cap?.canPost) {
    return NextResponse.json({ error: "Your account is read-only." }, { status: 403 });
  }

  const created = await seedDefaultChart(companyId);
  return NextResponse.json({ ok: true, created });
}
