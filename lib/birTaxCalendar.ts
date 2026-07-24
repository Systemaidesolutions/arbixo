// Live BIR "Tax Reminder" calendar, pulled from the same feed the BIR website's
// widget uses (reverse-engineered from bir.gov.ph/Tax-Reminder):
//
//   GET https://bir-cms-ws.bir.gov.ph/api/pub/templates/1135/datasets
//   headers: client-website-id: 2, origin: https://www.bir.gov.ph
//
// Each row is { content: { date: "MM/DD/YYYY", body: "<html>" } }. The body is
// a <strong>CATEGORY</strong> (SUBMISSION / FILING / PAYMENT / …) followed by a
// description paragraph.
//
// This is an undocumented government endpoint, so treat it as best-effort:
// responses are cached, calls are time-boxed, and the last good payload is kept
// in memory so a later BIR outage still serves something. Callers get ok:false
// when there's nothing to show and render a link-out fallback.

const FEED_URL = "https://bir-cms-ws.bir.gov.ph/api/pub/templates/1135/datasets?per_page=3000";
const FEED_HEADERS = {
  Accept: "application/json",
  "client-website-id": "2",
  origin: "https://www.bir.gov.ph",
};
const REVALIDATE_SECONDS = 6 * 60 * 60; // 6h — the BIR calendar changes at most daily
const TIMEOUT_MS = 8000;

export type BirReminder = {
  /** ISO date (YYYY-MM-DD) of the deadline. */
  date: string;
  /** SUBMISSION / FILING / PAYMENT / e-FILING / REGISTRATION / … (may be ""). */
  category: string;
  /** Plain-text description of what is due. */
  description: string;
};

export type BirCalendarResult =
  | { ok: true; entries: BirReminder[]; stale: boolean }
  | { ok: false };

type RawRow = { content?: { date?: string; body?: string } };

const ENTITIES: Record<string, string> = {
  nbsp: " ", amp: "&", lt: "<", gt: ">", quot: '"', apos: "'",
  ndash: "–", mdash: "—", rsquo: "’", lsquo: "‘",
  rdquo: "”", ldquo: "“", hellip: "…", deg: "°",
};

function decode(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&([a-z]+);/gi, (m, name) => ENTITIES[name.toLowerCase()] ?? m);
}

function stripHtml(html: string): string {
  return decode(html.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

// "MM/DD/YYYY" -> "YYYY-MM-DD" (or null if it doesn't parse).
function toIso(mdY: string): string | null {
  const m = mdY.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const [, mm, dd, yyyy] = m;
  const p = (n: string) => n.padStart(2, "0");
  return `${yyyy}-${p(mm)}-${p(dd)}`;
}

// The BIR feed's category text is inconsistent and often verbose
// ("REGISTRATION (Online thru ORUS or Manual)", "e-FILING & PAYMENT …"). Fold
// it into a few clean buckets for the badge.
function normalizeCategory(raw: string): string {
  const s = raw.toUpperCase();
  const filing = /FILING/.test(s);
  const payment = /PAYMENT|REMITTANCE/.test(s);
  if (filing && payment) return "FILING & PAYMENT";
  if (payment) return "PAYMENT";
  if (filing) return "FILING";
  if (/SUBMISSION/.test(s)) return "SUBMISSION";
  if (/DISTRIBUTION/.test(s)) return "DISTRIBUTION";
  if (/REGISTRATION/.test(s)) return "REGISTRATION";
  // Fall back to the first word, so an unforeseen category still reads sensibly.
  return (raw.split(/[\s(/&-]/)[0] || raw).toUpperCase().slice(0, 18);
}

function parseRow(row: RawRow): BirReminder | null {
  const rawDate = row.content?.date;
  const body = row.content?.body ?? "";
  if (!rawDate) return null;
  const date = toIso(rawDate);
  if (!date) return null;

  const catMatch = body.match(/<strong[^>]*>([\s\S]*?)<\/strong>/i);
  const rawCategory = catMatch ? stripHtml(catMatch[1]) : "";
  const category = rawCategory ? normalizeCategory(rawCategory) : "";

  // Drop the leading category paragraph so it isn't repeated in the description.
  const rest = body.replace(/<p[^>]*>\s*<strong[^>]*>[\s\S]*?<\/strong>\s*<\/p>/i, "");
  let description = stripHtml(rest) || stripHtml(body);
  // Some rows don't match that shape; strip a leftover leading category word.
  if (rawCategory && description.toUpperCase().startsWith(rawCategory.toUpperCase())) {
    description = description.slice(rawCategory.length).replace(/^[\s:.-]+/, "").trim();
  }
  return { date, category, description };
}

// Last successful payload, kept so a later fetch failure can still serve data.
let lastGood: { entries: BirReminder[]; at: number } | null = null;

async function fetchAll(): Promise<BirReminder[] | null> {
  try {
    const res = await fetch(FEED_URL, {
      headers: FEED_HEADERS,
      signal: AbortSignal.timeout(TIMEOUT_MS),
      next: { revalidate: REVALIDATE_SECONDS },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { data?: RawRow[] };
    const rows = Array.isArray(json.data) ? json.data : [];
    const entries = rows
      .map(parseRow)
      .filter((e): e is BirReminder => e !== null)
      .sort((a, b) => a.date.localeCompare(b.date));
    if (entries.length === 0) return null;
    lastGood = { entries, at: Date.now() };
    return entries;
  } catch {
    return null;
  }
}

/**
 * BIR tax reminders for one month (defaults to the current Philippine month),
 * sorted by date. Falls back to the last good payload if the live call fails.
 */
export async function getBirTaxReminders(year: number, month1to12: number): Promise<BirCalendarResult> {
  const fresh = await fetchAll();
  const source = fresh ?? lastGood?.entries ?? null;
  if (!source) return { ok: false };

  const prefix = `${year}-${String(month1to12).padStart(2, "0")}-`;
  const entries = source.filter((e) => e.date.startsWith(prefix));
  return { ok: true, entries, stale: fresh === null };
}
