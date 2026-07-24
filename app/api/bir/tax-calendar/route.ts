import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserRecord } from "@/lib/currentUser";
import { getBirTaxReminders } from "@/lib/birTaxCalendar";

// Current-month (or ?year=&month=) BIR tax reminders for the dashboard widget.
// Signed-in only, so it isn't an open proxy onto the BIR feed.
export async function GET(request: NextRequest) {
  const user = await getCurrentUserRecord();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const sp = request.nextUrl.searchParams;
  // Default to the current Philippine month (UTC+8, no DST).
  const now = new Date(Date.now() + 8 * 60 * 60 * 1000);
  const year = Number(sp.get("year")) || now.getUTCFullYear();
  const month = Number(sp.get("month")) || now.getUTCMonth() + 1;

  const monthLabel = new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

  const result = await getBirTaxReminders(year, month);
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, year, month, monthLabel, entries: [] },
      { headers: { "Cache-Control": "public, max-age=300" } },
    );
  }

  return NextResponse.json(
    { ok: true, year, month, monthLabel, entries: result.entries, stale: result.stale },
    { headers: { "Cache-Control": "public, max-age=1800" } },
  );
}
