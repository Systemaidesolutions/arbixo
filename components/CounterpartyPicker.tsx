"use client";

import { useEffect } from "react";
import type { Contact, CounterpartyType, Customer, Employee, Vendor } from "@prisma/client";

function displayName(party: { tradeName?: string | null; firstName?: string | null; lastName?: string | null }) {
  return party.tradeName || `${party.firstName ?? ""} ${party.lastName ?? ""}`.trim();
}

export function CounterpartyPicker({
  counterpartyType,
  counterpartyId,
  onTypeChange,
  onIdChange,
  vendors,
  employees,
  contacts,
  customers,
  types = ["VENDOR", "EMPLOYEE", "CONTACT", "CUSTOMER"],
  label = "Payee",
}: {
  counterpartyType: CounterpartyType | null;
  counterpartyId: string | null;
  onTypeChange: (t: CounterpartyType | null) => void;
  onIdChange: (id: string | null) => void;
  vendors: Vendor[];
  employees: Employee[];
  contacts: Contact[];
  customers: Customer[];
  types?: CounterpartyType[];
  label?: string;
}) {
  const options =
    counterpartyType === "VENDOR"
      ? vendors
      : counterpartyType === "EMPLOYEE"
        ? employees
        : counterpartyType === "CONTACT"
          ? contacts
          : counterpartyType === "CUSTOMER"
            ? customers
            : [];

  const field = "mt-1 w-full rounded border border-neutral-300 px-2 py-1.5 text-sm";
  const label_ = "block text-xs text-neutral-500";
  const TYPE_LABELS: Record<CounterpartyType, string> = {
    VENDOR: "Vendor",
    EMPLOYEE: "Employee",
    CONTACT: "Contact",
    CUSTOMER: "Customer",
  };

  // Single allowed type (e.g. Sales on Account only deals with
  // Customers) — skip the type dropdown entirely and show one picker.
  const singleType = types.length === 1 ? types[0] : null;

  useEffect(() => {
    if (singleType && counterpartyType !== singleType) {
      onTypeChange(singleType);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [singleType, counterpartyType]);

  if (singleType) {
    return (
      <label className={label_}>
        {label}
        <select
          value={counterpartyId ?? ""}
          onChange={(e) => onIdChange(e.target.value || null)}
          className={field}
        >
          <option value="">Select…</option>
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.code} — {displayName(o)}
            </option>
          ))}
        </select>
      </label>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <label className={label_}>
        {label} type
        <select
          value={counterpartyType ?? ""}
          onChange={(e) => {
            onTypeChange((e.target.value || null) as CounterpartyType | null);
            onIdChange(null);
          }}
          className={field}
        >
          <option value="">None</option>
          {types.map((t) => (
            <option key={t} value={t}>
              {TYPE_LABELS[t]}
            </option>
          ))}
        </select>
      </label>

      <label className={label_}>
        {label}
        <select
          value={counterpartyId ?? ""}
          onChange={(e) => onIdChange(e.target.value || null)}
          disabled={!counterpartyType}
          className={`${field} disabled:bg-neutral-100`}
        >
          <option value="">Select…</option>
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.code} — {displayName(o)}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
