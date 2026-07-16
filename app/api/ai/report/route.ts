import { NextRequest, NextResponse } from "next/server";
import { getCurrentCompany } from "@/lib/currentUser";
import { ASK_REPORTS, parseAskArbi } from "@/lib/askArbi";
import { llmResolveAsk } from "@/lib/askArbiLLM";
import { runAskReport } from "@/lib/askArbiRun";

export async function POST(request: NextRequest) {
  const company = await getCurrentCompany();
  if (!company) {
    return NextResponse.json({ error: "Complete company setup first." }, { status: 400 });
  }

  const body = (await request.json().catch(() => ({}))) as { query?: string };
  const query = (body.query ?? "").trim();
  if (!query) {
    return NextResponse.json({ error: "Ask for a report, e.g. “Cash Disbursement report for the current month”." }, { status: 400 });
  }

  const now = new Date();
  // 1) Rule-based first.
  let intent = parseAskArbi(query, now);
  let engine: "rule" | "ai" = "rule";

  // 2) If no report keyword matched, fall back to Claude (only if a key is set).
  if (!intent.reportId) {
    const ai = await llmResolveAsk(query, now);
    if (ai) {
      intent = ai;
      engine = "ai";
    }
  }

  if (!intent.reportId) {
    return NextResponse.json({
      error: "Sorry, I couldn't tell which report you mean. Try naming one of the reports, e.g. “Income Statement for this year”.",
      suggestions: ASK_REPORTS.map((r) => r.label),
    });
  }

  const report = ASK_REPORTS.find((r) => r.id === intent.reportId)!;
  const table = await runAskReport(company.id, intent.reportId, intent.from, intent.to);

  return NextResponse.json({
    engine,
    report: { id: report.id, label: report.label, href: report.href, category: report.category },
    from: intent.from,
    to: intent.to,
    periodLabel: intent.periodLabel,
    table, // null for deep-link-only reports
  });
}
