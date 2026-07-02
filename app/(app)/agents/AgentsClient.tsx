"use client";

import { useState } from "react";
import { PartyManager } from "./PartyManager";
import { PARTY_LABELS, type PartyEntityType } from "@/lib/parties";

const TABS: PartyEntityType[] = ["customer", "vendor", "employee", "contact"];

export function AgentsClient({
  companyId,
  initialData,
}: {
  companyId: string;
  initialData: Record<PartyEntityType, any[]>;
}) {
  const [tab, setTab] = useState<PartyEntityType>("customer");

  return (
    <main className="mx-auto max-w-6xl p-4 sm:p-8">
      <h1 className="mb-1 text-xl font-medium text-neutral-900">Agents</h1>
      <p className="mb-6 text-sm text-neutral-500">
        Customers, vendors, employees, and other contacts — split into separate tables so each can
        carry its own fields (credit terms for customers, remittance flags for vendors) without
        cluttering the others.
      </p>

      <div className="mb-6 flex gap-1 border-b border-neutral-200">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`border-b-2 px-3 py-2 text-sm ${
              tab === t
                ? "border-neutral-900 font-medium text-neutral-900"
                : "border-transparent text-neutral-500 hover:text-neutral-900"
            }`}
          >
            {PARTY_LABELS[t].plural} ({initialData[t]?.length ?? 0})
          </button>
        ))}
      </div>

      <PartyManager
        key={tab}
        entityType={tab}
        companyId={companyId}
        initialItems={initialData[tab] ?? []}
      />
    </main>
  );
}
