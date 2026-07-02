import { PrismaClient } from "@prisma/client";
import { getAuditActor } from "@/lib/auditContext";
import { getCurrentUser } from "@/lib/session";
import { companyAuditEnabled } from "@/lib/auditSettings";

// Models we never auto-audit:
//  - AuditLog: writing it would recurse.
//  - LedgerEntry: posts are logged explicitly (with amounts/doc no.), and
//    excluding it keeps postDocument's array-$transaction a pure
//    passthrough so its atomicity is never touched.
const EXCLUDED_MODELS = new Set(["AuditLog", "LedgerEntry"]);

function operationType(operation: string): "CREATE" | "UPDATE" | "DELETE" | null {
  if (operation === "create" || operation === "createMany") return "CREATE";
  if (operation === "update" || operation === "updateMany" || operation === "upsert") return "UPDATE";
  if (operation === "delete" || operation === "deleteMany") return "DELETE";
  return null; // reads, aggregates, counts — not audited
}

const VERB: Record<"CREATE" | "UPDATE" | "DELETE", string> = {
  CREATE: "Created",
  UPDATE: "Updated",
  DELETE: "Deleted",
};

/** Resolve "who is acting" — request-scoped actor, else the JWT, else system. */
async function resolveActor(): Promise<{ email: string; companyId: string | null }> {
  const actor = getAuditActor();
  if (actor) return { email: actor.email, companyId: actor.companyId };
  try {
    const session = await getCurrentUser();
    if (session) return { email: session.email, companyId: null };
  } catch {
    // no request context (scripts, build) — fall through to system
  }
  return { email: "system", companyId: null };
}

function makePrismaClient() {
  const base = new PrismaClient();

  return base.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          const type = model && !EXCLUDED_MODELS.has(model) ? operationType(operation) : null;

          // Excluded models and read operations pass straight through with
          // no extra await — this is the safe, documented base pattern and
          // leaves transactional writes (postDocument) untouched.
          if (!type) return query(args);

          const result = await query(args);
          // Skip auto-logging while a restore is running.
          if (getAuditActor()?.suppress) return result;
          try {
            const record =
              result && typeof result === "object" && !Array.isArray(result)
                ? (result as { id?: string; companyId?: string | null })
                : null;
            const actor = await resolveActor();
            const companyId = record?.companyId ?? actor.companyId ?? null;
            const enabled = await companyAuditEnabled(
              (id) => base.company.findUnique({ where: { id }, select: { auditLogEnabled: true } }),
              companyId
            );
            if (enabled) {
              await base.auditLog.create({
                data: {
                  companyId,
                  username: actor.email,
                  action: `${VERB[type]} ${model}`,
                  entityType: model,
                  entityId: record?.id ?? null,
                  operation: type,
                },
              });
            }
          } catch (err) {
            // Auditing must never break the write it records.
            console.error("[audit] auto-log failed:", err);
          }
          return result;
        },
      },
    },
  });
}

type ExtendedPrisma = ReturnType<typeof makePrismaClient>;

const globalForPrisma = globalThis as unknown as { prisma?: ExtendedPrisma };

export const prisma = globalForPrisma.prisma ?? makePrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
