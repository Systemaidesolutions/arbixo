import { getCurrentCompany, getCurrentCapability } from "@/lib/currentUser";
import { listApiCredentials } from "@/lib/apiCredentials";
import { ApiCredentialsManager } from "@/components/ApiCredentialsManager";

// Subscriber Setup > API Access. A Manager can generate/revoke keys for the
// external integration API (app/api/v1/**); other subscriber roles see the
// list read-only.
export default async function ApiAccessPage() {
  const company = await getCurrentCompany();
  const capability = await getCurrentCapability();
  const canEdit = Boolean(capability?.canApprove);

  if (!company) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-8 sm:px-8 sm:py-12">
        <h1 className="text-xl font-medium text-neutral-900">API Access</h1>
        <p className="mt-2 text-neutral-600">Complete company setup first.</p>
      </main>
    );
  }

  const credentials = await listApiCredentials(company.id);

  return (
    <main className="mx-auto max-w-2xl px-4 py-8 sm:px-8 sm:py-12">
      <h1 className="text-xl font-medium text-neutral-900">API Access</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Connect an external system — your own accounting engine, a core banking system, or similar — so it can post and
        read this company&apos;s books directly, without a logged-in user.
        {!canEdit && " Only a Manager can generate or revoke keys."}
      </p>

      <div className="mt-6">
        <ApiCredentialsManager
          initial={credentials.map((c) => ({ ...c, createdAt: c.createdAt.toISOString(), lastUsedAt: c.lastUsedAt?.toISOString() ?? null, revokedAt: c.revokedAt?.toISOString() ?? null }))}
          canEdit={canEdit}
        />
      </div>
    </main>
  );
}
