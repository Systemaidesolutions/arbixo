"use client";

import { useState } from "react";

type CompanyOption = { id: string; tradeName: string };

export function BackupClient({
  isAdmin,
  companies,
  ownCompany,
}: {
  isAdmin: boolean;
  companies: CompanyOption[];
  ownCompany: CompanyOption | null;
}) {
  const [companyId, setCompanyId] = useState<string>(
    isAdmin ? companies[0]?.id ?? "" : ownCompany?.id ?? ""
  );

  function downloadCompany() {
    if (!companyId) return;
    window.location.href = `/api/utility/backup/company?companyId=${companyId}`;
  }

  function downloadDatabase() {
    window.location.href = `/api/utility/backup/database`;
  }

  const cardBtn =
    "rounded bg-brand-navy px-4 py-2 text-sm text-white hover:bg-brand-navyLight disabled:opacity-50";

  return (
    <div className="mt-6 space-y-5">
      {/* Per Company */}
      <section className="rounded-xl border border-neutral-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-neutral-800">Per company</h2>
        <p className="mt-1 text-xs text-neutral-500">
          Backs up one company and everything scoped to it — accounts, agents, ledger entries, tax
          setup and audit trail.
        </p>

        {isAdmin ? (
          companies.length === 0 ? (
            <p className="mt-3 text-sm text-neutral-500">No companies to back up yet.</p>
          ) : (
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <select
                value={companyId}
                onChange={(e) => setCompanyId(e.target.value)}
                className="rounded border border-neutral-300 px-2 py-1.5 text-sm"
              >
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.tradeName}
                  </option>
                ))}
              </select>
              <button onClick={downloadCompany} className={cardBtn}>
                Download company backup
              </button>
            </div>
          )
        ) : ownCompany ? (
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <span className="text-sm text-neutral-700">{ownCompany.tradeName}</span>
            <button onClick={downloadCompany} className={cardBtn}>
              Download company backup
            </button>
          </div>
        ) : (
          <p className="mt-3 text-sm text-neutral-500">
            No company is assigned to your account yet.
          </p>
        )}
      </section>

      {/* Whole Database — admin only */}
      {isAdmin && (
        <section className="rounded-xl border border-neutral-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-neutral-800">Whole database</h2>
          <p className="mt-1 text-xs text-neutral-500">
            Backs up every company and all shared data in one file.
          </p>
          <button onClick={downloadDatabase} className={`${cardBtn} mt-3`}>
            Download whole-database backup
          </button>
        </section>
      )}
    </div>
  );
}
