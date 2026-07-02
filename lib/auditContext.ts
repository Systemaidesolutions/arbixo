import { AsyncLocalStorage } from "node:async_hooks";

export type AuditActor = {
  userId: string;
  email: string;
  companyId: string | null;
  // When true, the Prisma extension skips auto-logging — used to keep a
  // restore's bulk deletes/inserts from flooding the audit trail.
  suppress?: boolean;
};

// Per-request store of "who is acting", read by the audit extension in
// lib/prisma.ts when it auto-logs a write. Set by getCurrentUserRecord so
// any authenticated route populates it without extra wiring.
const store = new AsyncLocalStorage<AuditActor>();

export function setAuditActor(actor: AuditActor): void {
  store.enterWith(actor);
}

export function getAuditActor(): AuditActor | undefined {
  return store.getStore();
}

export function setAuditSuppressed(suppress: boolean): void {
  const current = store.getStore();
  store.enterWith({
    userId: current?.userId ?? "",
    email: current?.email ?? "system",
    companyId: current?.companyId ?? null,
    suppress,
  });
}
