import Link from "next/link";
import { PERMISSION_KEYS, permissionLabel, type PermissionKey } from "@/lib/userPermissions";

// Shown when a page needs an access group an admin removed from this user
// (Admin › User access). See app/(app)/layout.tsx.
export default function NoAccessPage({ searchParams }: { searchParams: { need?: string } }) {
  const need = (searchParams.need ?? "").split(",").filter((k): k is PermissionKey => PERMISSION_KEYS.includes(k as PermissionKey));
  return (
    <div className="mx-auto mt-16 max-w-md rounded-lg border border-neutral-200 bg-white p-6 text-center">
      <h1 className="text-lg font-semibold text-neutral-900">You don&apos;t have access to this page</h1>
      {need.length > 0 && (
        <p className="mt-2 text-sm text-neutral-600">
          It needs <b>{need.map(permissionLabel).join(" or ")}</b> access.
        </p>
      )}
      <p className="mt-2 text-sm text-neutral-600">Ask your ARbixo admin to turn it on for your account.</p>
      <Link href="/dashboard" className="mt-4 inline-block rounded bg-brand-blue px-4 py-2 text-sm font-medium text-white hover:opacity-90">
        Go to dashboard
      </Link>
    </div>
  );
}
