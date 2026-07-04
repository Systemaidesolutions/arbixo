// Cross-app link to the ARbixo Core ticketing system: when a company is
// created here, create a matching project over there.
//
// ARbixo Core is a separate Supabase project with authenticated-only RLS, so
// this uses its SERVICE_ROLE key (server-side only — never expose to the
// browser) to insert straight into the `projects` table via PostgREST.
//
// Configure via env (both required; absent = feature is a no-op):
//   ARBIXO_CORE_SUPABASE_URL       e.g. https://<ref>.supabase.co
//   ARBIXO_CORE_SERVICE_ROLE_KEY   the service_role secret

const STOPWORDS = new Set([
  "and", "the", "of", "for", "co", "inc", "corp", "corporation", "company",
  "incorporated", "ltd", "llc", "enterprises", "enterprise", "solutions",
]);

// A short uppercase project key from the company name — initials of the
// significant words (e.g. "Businessaide System Accounting" -> "BSA"), or the
// first few letters of a single-word name. 2–5 chars.
export function deriveProjectKey(name: string): string {
  const words = name
    .replace(/[^A-Za-z0-9 ]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter((w) => w && !STOPWORDS.has(w.toLowerCase()));

  let base =
    words.length >= 2
      ? words.slice(0, 5).map((w) => w[0]).join("")
      : (words[0] ?? "PRJ").slice(0, 4);

  base = base.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (base.length < 2) base = (base + "PRJ").slice(0, 3);
  return base;
}

type CompanyLike = {
  registeredName?: string | null;
  tradeName: string;
  tin: string;
};

/**
 * Creates a project in ARbixo Core for a freshly-created company. Returns the
 * project key on success, or null if the feature is disabled or the call
 * failed — callers must treat this as best-effort and never let a failure
 * block company creation.
 */
export async function createTicketProjectForCompany(company: CompanyLike): Promise<string | null> {
  const url = process.env.ARBIXO_CORE_SUPABASE_URL;
  const serviceKey = process.env.ARBIXO_CORE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null; // not configured — skip silently

  const name = (company.registeredName || company.tradeName || "").trim() || "New Company";
  const description = `${company.tradeName} — TIN ${company.tin}. Linked from the Arbixo accounting app.`;
  const baseKey = deriveProjectKey(name);

  const endpoint = `${url.replace(/\/$/, "")}/rest/v1/projects`;
  const headers = {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    "Content-Type": "application/json",
    Prefer: "return=representation",
  };

  // Project keys are unique in ARbixo Core; on collision, suffix and retry.
  for (let attempt = 0; attempt < 12; attempt++) {
    const key = attempt === 0 ? baseKey : `${baseKey}${attempt + 1}`;
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify({ key, name, description }),
      });
      if (res.ok) return key;
      if (res.status === 409) continue; // duplicate key — try the next suffix
      // Any other status: log and give up (best-effort).
      console.error(`[ticketingSync] project create failed (${res.status}):`, await res.text().catch(() => ""));
      return null;
    } catch (err) {
      console.error("[ticketingSync] project create error:", err);
      return null;
    }
  }
  return null;
}
