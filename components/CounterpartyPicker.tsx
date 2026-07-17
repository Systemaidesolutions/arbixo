"use client";

import { useEffect, useState } from "react";
import type { Contact, CounterpartyType, Customer, Employee, Vendor } from "@prisma/client";
import { QuickCreateModal, NewPartyForm } from "@/components/QuickCreate";

type AnyParty = Customer | Vendor | Employee | Contact;

// A native <select> can only render plain text per option, so the columns are
// aligned with padding + a monospace font, and the header is an <optgroup>
// label (non-selectable) above the rows.
type PartyRow = {
  code?: string | null; registeredName?: string | null; tradeName?: string | null;
  lastName?: string | null; firstName?: string | null;
};
const COL_CODE = 8;
const COL_REG = 30;
const COL_TRADE = 26;
const pad = (s: string, w: number) => (s.length > w ? `${s.slice(0, w - 1)}…` : s.padEnd(w, " "));

function registeredOf(p: PartyRow): string {
  const person = [p.lastName, p.firstName].filter(Boolean).join(", ");
  return (p.registeredName || person || "").trim();
}
function optionRow(party: AnyParty): string {
  const p = party as unknown as PartyRow;
  return `${pad(p.code ?? "", COL_CODE)} ${pad(registeredOf(p), COL_REG)} ${pad(p.tradeName ?? "", COL_TRADE)}`.trimEnd();
}
const OPTION_HEADER = `${pad("Code", COL_CODE)} ${pad("Registered Name", COL_REG)} ${pad("Trade Name", COL_TRADE)}`;

function partyDetails(party: AnyParty): { tin: string; address: string } {
  const p = party as unknown as {
    tin?: string | null; address?: string | null; barangay?: string | null;
    city?: string | null; province?: string | null; zipCode?: string | null;
  };
  return {
    tin: p.tin ?? "",
    address: [p.address, p.barangay, p.city, p.province, p.zipCode].filter(Boolean).join(", "),
  };
}

const TYPE_LABELS: Record<CounterpartyType, string> = {
  VENDOR: "Vendor",
  EMPLOYEE: "Employee",
  CONTACT: "Contact",
  CUSTOMER: "Customer",
};

const NEW = "__new__";

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
  companyId,
  onCreated,
  showDetails = false,
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
  // When provided, the party dropdown offers "＋ New …" which opens a modal
  // and, on success, calls onCreated so the parent form can append + select.
  companyId?: string;
  onCreated?: (type: CounterpartyType, record: AnyParty) => void;
  // Show the selected party's TIN and address beneath the dropdown.
  showDetails?: boolean;
}) {
  const [showNew, setShowNew] = useState(false);

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

  const canCreate = !!companyId && !!onCreated && !!counterpartyType;

  const selected = counterpartyId ? options.find((o) => o.id === counterpartyId) : undefined;
  const details = selected ? partyDetails(selected) : null;
  const detailBlock =
    showDetails && details && (details.tin || details.address) ? (
      <div className="mt-1 rounded border border-neutral-200 bg-neutral-50 px-2 py-1 text-xs text-neutral-500">
        {details.tin ? <div>TIN: <span className="font-mono text-neutral-700">{details.tin}</span></div> : null}
        {details.address ? <div>{details.address}</div> : null}
      </div>
    ) : null;

  const field = "mt-1 w-full rounded border border-neutral-300 px-2 py-1.5 text-sm";
  const label_ = "block text-xs text-neutral-500";

  const singleType = types.length === 1 ? types[0] : null;

  useEffect(() => {
    if (singleType && counterpartyType !== singleType) onTypeChange(singleType);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [singleType, counterpartyType]);

  function handleSelect(value: string) {
    if (value === NEW) {
      setShowNew(true);
      return;
    }
    onIdChange(value || null);
  }

  const partySelect = (disabled = false) => (
    <select
      value={counterpartyId ?? ""}
      onChange={(e) => handleSelect(e.target.value)}
      disabled={disabled}
      className={`${field} font-mono text-xs disabled:bg-neutral-100`}
    >
      <option value="">Select…</option>
      {canCreate && <option value={NEW}>＋ New {TYPE_LABELS[counterpartyType!].toLowerCase()}…</option>}
      <optgroup label={OPTION_HEADER}>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {optionRow(o)}
          </option>
        ))}
      </optgroup>
    </select>
  );

  const modal =
    showNew && canCreate ? (
      <QuickCreateModal title={`New ${TYPE_LABELS[counterpartyType!].toLowerCase()}`} onClose={() => setShowNew(false)}>
        <NewPartyForm
          companyId={companyId!}
          type={counterpartyType!}
          onCancel={() => setShowNew(false)}
          onCreated={(record) => {
            onCreated!(counterpartyType!, record);
            setShowNew(false);
          }}
        />
      </QuickCreateModal>
    ) : null;

  if (singleType) {
    return (
      <label className={label_}>
        {label}
        {partySelect(false)}
        {detailBlock}
        {modal}
      </label>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
        {partySelect(!counterpartyType)}
        {detailBlock}
      </label>
      {modal}
    </div>
  );
}
