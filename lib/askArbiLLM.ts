import { ASK_REPORTS, ASK_REPORT_IDS, type AskIntent } from "@/lib/askArbi";

// Optional Claude fallback for "Ask ARbi". Uses the Anthropic Messages API via
// fetch (no SDK dependency) and only runs when ANTHROPIC_API_KEY is set — so the
// app builds and the rule-based path works with no key configured. Forced
// tool-use gives us a structured { reportId, dateFrom, dateTo, periodLabel }.

const MODEL = "claude-opus-4-8";

export async function llmResolveAsk(query: string, now: Date): Promise<(AskIntent & { engine: "ai" }) | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const today = now.toISOString().slice(0, 10);
  const catalog = ASK_REPORTS.map((r) => `- ${r.id}: ${r.label}`).join("\n");

  const tool = {
    name: "select_report",
    description: "Choose which accounting report to generate and the date range to cover.",
    strict: true,
    input_schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        reportId: { type: "string", enum: ASK_REPORT_IDS, description: "The report the user wants." },
        dateFrom: { type: "string", description: "Start date, YYYY-MM-DD." },
        dateTo: { type: "string", description: "End date, YYYY-MM-DD." },
        periodLabel: { type: "string", description: "Short human label for the period, e.g. 'July 2026' or 'Q2 2026'." },
      },
      required: ["reportId", "dateFrom", "dateTo", "periodLabel"],
    },
  };

  const prompt = `Today's date is ${today}. You help pick an accounting report for a Philippine business and resolve the date range from the user's request (interpret relative periods like "current month", "last quarter", "this year", "YTD" relative to today; default to the current month if no period is given).

Available reports:
${catalog}

User request: "${query}"

Call the select_report tool with the best matching report and the resolved date range.`;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 512,
        tools: [tool],
        tool_choice: { type: "tool", name: "select_report" },
        messages: [{ role: "user", content: prompt }],
      }),
      // Don't let a slow model hang the request forever.
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { content?: { type: string; name?: string; input?: Record<string, unknown> }[] };
    const toolUse = data.content?.find((b) => b.type === "tool_use" && b.name === "select_report");
    const input = toolUse?.input as { reportId?: string; dateFrom?: string; dateTo?: string; periodLabel?: string } | undefined;
    if (!input?.reportId || !ASK_REPORT_IDS.includes(input.reportId)) return null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.dateFrom ?? "") || !/^\d{4}-\d{2}-\d{2}$/.test(input.dateTo ?? "")) return null;
    return {
      reportId: input.reportId,
      from: input.dateFrom!,
      to: input.dateTo!,
      periodLabel: input.periodLabel || `${input.dateFrom} to ${input.dateTo}`,
      engine: "ai",
    };
  } catch {
    // Network error, timeout, or malformed response — fall back gracefully.
    return null;
  }
}
