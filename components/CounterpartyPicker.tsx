"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Contact, CounterpartyType, Customer, Employee, Vendor } from "@prisma/client";
import { QuickCreateModal, NewPartyForm } from "@/components/QuickCreate";

type AnyParty = Customer | Vendor | Employee | Contact;

type PartyRow = {
  code?: string | null; registeredName?: string | null; tradeName?: string | null;
  lastName?: string | null; firstName?: string | null;
};

function registeredOf(p: PartyRow): string {
  const person = [p.lastName, p.firstName].filter(Boolean).join(", ");
  return (p.registeredName || person || "").trim();
}
// Text a user might type to find this party by — code, registered name, or
// trade name, all lower-cased into one blob for a simple substring filter.
function searchBlob(party: AnyParty): string {
  const p = party as unknown as PartyRow;
  return [p.code, registeredOf(p), p.tradeName].filter(Boolean).join(" ").toLowerCase();
}
// What the field shows once something's selected (not actively being
// edited) — trade name only (falls back to the registered/person name for
// employees, who have no trade name). Search still matches on registered
// name too; this only changes what's displayed. Reports are unaffected —
// they keep showing the registered name via lib/ledgerSearch.ts etc.
function displayLabel(party: AnyParty): string {
  const p = party as unknown as PartyRow;
  const name = p.tradeName || registeredOf(p) || "";
  return p.code ? `${p.code} — ${name}` : name;
}

function partyDetails(party: AnyParty): { tin: string; address: string } {
  const p = party as unknown as {
    tin?: string | null; address?: string | null; barangay?: string | null;
    district?: string | null; city?: string | null; province?: string | null; zipCode?: string | null;
  };
  return {
    tin: p.tin ?? "",
    address: [p.address, p.barangay, p.district, p.city, p.province, p.zipCode].filter(Boolean).join(", "),
  };
}

const TYPE_LABELS: Record<CounterpartyType, string> = {
  VENDOR: "Vendor",
  EMPLOYEE: "Employee",
  CONTACT: "Contact",
  CUSTOMER: "Customer",
};

// A type-to-filter combobox (Business Central style): typing narrows the
// list by code / registered name / trade name; clicking a row (or Enter)
// selects it. Replaces a plain <select>, which can't be searched.
function PartyCombobox({
  options,
  selectedId,
  onSelect,
  disabled,
  canCreate,
  onNew,
  newLabel,
}: {
  options: AnyParty[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  disabled?: boolean;
  canCreate?: boolean;
  onNew?: () => void;
  newLabel?: string;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selected = selectedId ? options.find((o) => o.id === selectedId) : undefined;

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return options;
    return options.filter((o) => searchBlob(o).includes(needle));
  }, [options, query]);

  useEffect(() => {
    setHighlight(0);
  }, [query, open]);

  useEffect(() => () => { if (blurTimer.current) clearTimeout(blurTimer.current); }, []);

  function selectOption(o: AnyParty) {
    onSelect(o.id);
    setQuery("");
    setOpen(false);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "Enter") {
        setOpen(true);
        e.preventDefault();
      }
      return;
    }
    const maxIndex = filtered.length - 1 + (canCreate ? 1 : 0);
    if (e.key === "ArrowDown") {
      setHighlight((h) => Math.min(h + 1, maxIndex));
      e.preventDefault();
    } else if (e.key === "ArrowUp") {
      setHighlight((h) => Math.max(h - 1, 0));
      e.preventDefault();
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (canCreate && highlight === filtered.length) {
        onNew?.();
        setOpen(false);
        return;
      }
      const o = filtered[highlight];
      if (o) selectOption(o);
    } else if (e.key === "Escape") {
      setOpen(false);
      setQuery("");
      (e.target as HTMLInputElement).blur();
    }
  }

  const field = "mt-1 w-full rounded border border-neutral-300 px-2 py-1.5 text-sm";
  const rowBase = "flex w-full items-center gap-3 px-2 py-1.5 text-left text-xs hover:bg-neutral-50";

  return (
    <div className="relative">
      <input
        disabled={disabled}
        value={open ? query : selected ? displayLabel(selected) : ""}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => {
          setQuery("");
          setOpen(true);
        }}
        onBlur={() => {
          // Delay so a click on a dropdown row (which also blurs the input)
          // still registers before the list disappears.
          blurTimer.current = setTimeout(() => setOpen(false), 150);
        }}
        onKeyDown={handleKeyDown}
        placeholder="Type to search…"
        className={`${field} disabled:bg-neutral-100`}
        autoComplete="off"
      />
      {open && (
        <div className="absolute z-20 mt-1 max-h-64 w-full min-w-[420px] overflow-auto rounded border border-neutral-300 bg-white shadow-lg">
          {canCreate && (
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                onNew?.();
                setOpen(false);
              }}
              className={`${rowBase} font-medium text-brand-navy ${highlight === filtered.length ? "bg-blue-50" : ""}`}
            >
              ＋ {newLabel ?? "New…"}
            </button>
          )}
          {filtered.length === 0 ? (
            <div className="px-2 py-2 text-xs text-neutral-400">No matches</div>
          ) : (
            filtered.map((o, i) => {
              const p = o as unknown as PartyRow;
              return (
                <button
                  type="button"
                  key={o.id}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    selectOption(o);
                  }}
                  className={`${rowBase} ${i === highlight ? "bg-blue-50" : ""}`}
                >
                  <span className="w-24 shrink-0 truncate font-mono text-neutral-500">{p.code}</span>
                  <span className="truncate text-neutral-900">{p.tradeName || registeredOf(p)}</span>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
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

  const partyCombobox = (disabled = false) => (
    <PartyCombobox
      options={options}
      selectedId={counterpartyId}
      onSelect={(id) => onIdChange(id)}
      disabled={disabled}
      canCreate={canCreate}
      onNew={() => setShowNew(true)}
      newLabel={counterpartyType ? `New ${TYPE_LABELS[counterpartyType].toLowerCase()}…` : undefined}
    />
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
        {partyCombobox(false)}
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
        {partyCombobox(!counterpartyType)}
        {detailBlock}
      </label>
      {modal}
    </div>
  );
}
