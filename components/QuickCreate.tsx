"use client";

import { useState } from "react";
import { X } from "lucide-react";
import type {
  Account,
  AccountClassification,
  Contact,
  CounterpartyType,
  Customer,
  Employee,
  Vendor,
} from "@prisma/client";
import { CLASSIFICATION_LABELS, CLASSIFICATION_ORDER } from "@/lib/accounts";

/** Floating modal shell used by all the quick-create forms. */
export function QuickCreateModal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden />
      <div className="relative w-full max-w-md rounded-xl border border-neutral-200 bg-white p-5 shadow-xl">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-neutral-900">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
          >
            <X size={18} />
          </button>
        </div>
        <div className="mt-3">{children}</div>
      </div>
    </div>
  );
}

const field = "mt-1 w-full rounded border border-neutral-300 px-2 py-1.5 text-sm";
const labelCls = "block text-xs text-neutral-500";

const PARTY_ENDPOINT: Record<CounterpartyType, { url: string; key: string; label: string }> = {
  CUSTOMER: { url: "/api/customers", key: "customer", label: "customer" },
  VENDOR: { url: "/api/vendors", key: "vendor", label: "vendor" },
  EMPLOYEE: { url: "/api/employees", key: "employee", label: "employee" },
  CONTACT: { url: "/api/contacts", key: "contact", label: "contact" },
};

type AnyParty = Customer | Vendor | Employee | Contact;

/**
 * Minimal "quick create" for a party. Captures just enough to post a valid
 * record with sensible defaults (Non-Individual, VAT); full details can be
 * filled in later on the Agents page.
 */
export function NewPartyForm({
  companyId,
  type,
  onCreated,
  onCancel,
}: {
  companyId: string;
  type: CounterpartyType;
  onCreated: (record: AnyParty) => void;
  onCancel: () => void;
}) {
  const isEmployee = type === "EMPLOYEE";
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [lastName, setLastName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [registrationType, setRegistrationType] = useState<"VAT" | "NON_VAT">("VAT");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);

    const ep = PARTY_ENDPOINT[type];
    const payload: Record<string, unknown> = isEmployee
      ? { companyId, code, lastName, firstName }
      : {
          companyId,
          code,
          tradeName: name,
          registeredName: name,
          taxClassification: "NON_INDIVIDUAL",
          registrationType,
          ...(type === "CUSTOMER" ? { customerType: "PRIVATE" } : {}),
          ...(type === "VENDOR" ? { vendorType: "SUPPLIER" } : {}),
        };

    const res = await fetch(ep.url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setBusy(false);
    if (!res.ok) {
      setError((await res.json().catch(() => ({})))?.error ?? "Could not create.");
      return;
    }
    const data = await res.json();
    onCreated(data[ep.key] as AnyParty);
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <label className={labelCls}>
        Code
        <input required autoFocus value={code} onChange={(e) => setCode(e.target.value)} className={field} />
      </label>

      {isEmployee ? (
        <div className="grid grid-cols-2 gap-3">
          <label className={labelCls}>
            Last name
            <input required value={lastName} onChange={(e) => setLastName(e.target.value)} className={field} />
          </label>
          <label className={labelCls}>
            First name
            <input required value={firstName} onChange={(e) => setFirstName(e.target.value)} className={field} />
          </label>
        </div>
      ) : (
        <>
          <label className={labelCls}>
            Name
            <input required value={name} onChange={(e) => setName(e.target.value)} className={field} />
          </label>
          <label className={labelCls}>
            Registration
            <select
              value={registrationType}
              onChange={(e) => setRegistrationType(e.target.value as "VAT" | "NON_VAT")}
              className={field}
            >
              <option value="VAT">VAT</option>
              <option value="NON_VAT">Non-VAT</option>
            </select>
          </label>
        </>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
      <p className="text-[11px] text-neutral-400">
        Only the essentials — edit full details later under Agents.
      </p>

      <div className="flex justify-end gap-2 pt-1">
        <button type="button" onClick={onCancel} className="rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50">
          Cancel
        </button>
        <button type="submit" disabled={busy} className="rounded bg-brand-navy px-3 py-1.5 text-sm text-white hover:bg-brand-navyLight disabled:opacity-50">
          {busy ? "Creating…" : "Create"}
        </button>
      </div>
    </form>
  );
}

/** Quick create for a Chart of Accounts entry. */
export function NewAccountForm({
  companyId,
  onCreated,
  onCancel,
}: {
  companyId: string;
  onCreated: (account: Account) => void;
  onCancel: () => void;
}) {
  const [code, setCode] = useState("");
  const [title, setTitle] = useState("");
  const [classification, setClassification] = useState<AccountClassification>("EXPENSE");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const res = await fetch("/api/accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyId, code, title, classification }),
    });
    setBusy(false);
    if (!res.ok) {
      setError((await res.json().catch(() => ({})))?.error ?? "Could not create.");
      return;
    }
    const data = await res.json();
    onCreated(data.account as Account);
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid grid-cols-[110px_1fr] gap-3">
        <label className={labelCls}>
          Code
          <input required autoFocus value={code} onChange={(e) => setCode(e.target.value)} className={field} />
        </label>
        <label className={labelCls}>
          Title
          <input required value={title} onChange={(e) => setTitle(e.target.value)} className={field} />
        </label>
      </div>
      <label className={labelCls}>
        Classification
        <select
          value={classification}
          onChange={(e) => setClassification(e.target.value as AccountClassification)}
          className={field}
        >
          {CLASSIFICATION_ORDER.map((c) => (
            <option key={c} value={c}>
              {CLASSIFICATION_LABELS[c]}
            </option>
          ))}
        </select>
      </label>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex justify-end gap-2 pt-1">
        <button type="button" onClick={onCancel} className="rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50">
          Cancel
        </button>
        <button type="submit" disabled={busy} className="rounded bg-brand-navy px-3 py-1.5 text-sm text-white hover:bg-brand-navyLight disabled:opacity-50">
          {busy ? "Creating…" : "Create"}
        </button>
      </div>
    </form>
  );
}
