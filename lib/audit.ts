import { prisma } from "@/lib/prisma";
import { companyAuditEnabled } from "@/lib/auditSettings";
import type { NextRequest } from "next/server";

/** Best-effort client IP from the usual proxy headers (Vercel sets these). */
export function getClientIp(request: NextRequest): string | null {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return request.headers.get("x-real-ip");
}

/**
 * Records one audit-trail entry for a company. Deliberately swallows its
 * own errors — auditing must never break the action it's recording.
 */
export async function logAudit(params: {
  companyId: string;
  username: string;
  action: string;
  ipAddress?: string | null;
}): Promise<void> {
  try {
    const enabled = await companyAuditEnabled(
      (id) => prisma.company.findUnique({ where: { id }, select: { auditLogEnabled: true } }),
      params.companyId
    );
    if (!enabled) return;

    await prisma.auditLog.create({
      data: {
        companyId: params.companyId,
        username: params.username,
        action: params.action,
        ipAddress: params.ipAddress ?? null,
      },
    });
  } catch (err) {
    console.error("[audit] failed to write audit log:", err);
  }
}

export type AuditRow = {
  id: string;
  createdAt: string;
  companyId: string | null;
  companyName: string | null;
  username: string;
  ipAddress: string | null;
  action: string;
};

/** Most recent audit entries, optionally scoped to one company. */
export async function getAuditTrail(opts: {
  companyId?: string;
  limit?: number;
}): Promise<AuditRow[]> {
  const logs = await prisma.auditLog.findMany({
    where: opts.companyId ? { companyId: opts.companyId } : {},
    include: { company: { select: { tradeName: true } } },
    orderBy: { createdAt: "desc" },
    take: opts.limit ?? 300,
  });
  return logs.map((l) => ({
    id: l.id,
    createdAt: l.createdAt.toISOString(),
    companyId: l.companyId,
    companyName: l.company?.tradeName ?? null,
    username: l.username,
    ipAddress: l.ipAddress,
    action: l.action,
  }));
}
