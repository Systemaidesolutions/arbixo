"use client";

import { RDO_CODES } from "@/lib/ph-locations";

/**
 * BIR RDO picker. A native select of the full RDO list (code — location).
 * If the current value isn't a known option (e.g. legacy free-text data), it's
 * shown as a selected option so nothing is silently dropped.
 */
export function RdoSelect({
  value,
  onChange,
  disabled = false,
  required = false,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  required?: boolean;
  className?: string;
}) {
  const options = RDO_CODES.map((r) => `${r.code} — ${r.name}`);
  const known = options.includes(value);

  return (
    <select
      required={required}
      disabled={disabled}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={className}
    >
      <option value="">Select RDO…</option>
      {!known && value && <option value={value}>{value}</option>}
      {RDO_CODES.map((r) => {
        const v = `${r.code} — ${r.name}`;
        return (
          <option key={r.code} value={v}>
            {r.code} — {r.name}
          </option>
        );
      })}
    </select>
  );
}
