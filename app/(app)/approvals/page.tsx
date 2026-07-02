import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUserRecord } from "@/lib/currentUser";
import { capabilitiesFor } from "@/lib/permissions";
import { ApprovalsClient, type PendingDoc } from "./ApprovalsClient";

export default async function ApprovalsPage() {
  const user = await getCurrentUserRecord();
  if (!user) redirect("/login");
  const capability = capabilitiesFor(user.role, user.subscriberSubtype);
  // Only a Manager can approve.
  if (!capability.canApprove || !user.companyId) redirect("/");

  const entries = await prisma.ledgerEntry.findMany({
    where: { companyId: user.companyId, isCancelled: false, isApproved: false },
    select: {
      journalType: true,
      documentNo: true,
      postingDate: true,
      debitAmount: true,
      createdById: true,
    },
    orderBy: [{ postingDate: "asc" }],
  });

  // Group lines into documents.
  const byDoc = new Map<string, PendingDoc & { createdById: string | null }>();
  for (const e of entries) {
    const key = `${e.journalType}|${e.documentNo}`;
    const existing = byDoc.get(key);
    const debit = Number(e.debitAmount);
    if (existing) {
      existing.total += debit;
      existing.lines += 1;
    } else {
      byDoc.set(key, {
        journalType: e.journalType,
        documentNo: e.documentNo,
        postingDate: e.postingDate.toISOString().slice(0, 10),
        total: debit,
        lines: 1,
        postedBy: null,
        createdById: e.createdById,
      });
    }
  }

  // Resolve poster emails.
  const posterIds = [...new Set([...byDoc.values()].map((d) => d.createdById).filter(Boolean))] as string[];
  const posters = posterIds.length
    ? await prisma.user.findMany({ where: { id: { in: posterIds } }, select: { id: true, email: true } })
    : [];
  const emailById = new Map(posters.map((p) => [p.id, p.email]));

  const docs: PendingDoc[] = [...byDoc.values()].map((d) => ({
    journalType: d.journalType,
    documentNo: d.documentNo,
    postingDate: d.postingDate,
    total: Math.round(d.total * 100) / 100,
    lines: d.lines,
    postedBy: d.createdById ? emailById.get(d.createdById) ?? null : null,
  }));

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-8 sm:py-12">
      <h1 className="text-xl font-medium text-neutral-900">Pending approvals</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Transactions posted by Users await your review. Approving stamps them as reviewed; it
        doesn&apos;t change the books (posted entries already appear in reports).
      </p>
      <ApprovalsClient companyId={user.companyId} docs={docs} />
    </main>
  );
}
