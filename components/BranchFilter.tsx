"use client";

import { branchOptionLabel } from "@/lib/branchLabel";

export type Branch = { id: string; name: string; branchCode: string | null };

/**
 * Branch (Location) picker for BIR reports. Defaults to "All branches"
 * (consolidated); selecting a branch filters the report — and its .DAT/CSV
 * export — to entries tagged with that Location. Renders nothing when the
 * company has no branches set up.
 */
export function BranchFilter({
  locations,
  value,
  onChange,
  fieldClass,
}: {
  locations: Branch[];
  value: string;
  onChange: (id: string) => void;
  fieldClass: string;
}) {
  if (locations.length === 0) return null;
  return (
    <label className="text-xs text-neutral-500">
      Branch
      <select value={value} onChange={(e) => onChange(e.target.value)} className={`mt-1 block ${fieldClass}`}>
        <option value="">All branches</option>
        {locations.map((l) => (
          <option key={l.id} value={l.id}>
            {branchOptionLabel(l)}
          </option>
        ))}
      </select>
    </label>
  );
}
