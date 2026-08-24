"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import type {
  Account,
  AccountClassification,
  Contact,
  CounterpartyType,
  Customer,
  CustomerType,
  Employee,
  RegistrationType,
  TaxClassification,
  Vendor,
  VendorType,
} from "@prisma/client";
import { CLASSIFICATION_LABELS, CLASSIFICATION_ORDER } from "@/lib/accounts";
import { TAX_CLASSIFICATION_LABELS, REGISTRATION_TYPE_LABELS } from "@/lib/company";
import { CUSTOMER_TYPE_LABELS, VENDOR_TYPE_LABELS } from "@/lib/parties";
import { TinInput } from "@/components/TinInput";
import { AddressFields } from "@/components/AddressFields";

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
  // Rendered through a portal to <body> so the modal's <form> is never nested
  // inside the surrounding transaction <form> (nested forms are invalid HTML
  // and make the modal's submit button post the outer form instead).
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden />
      <div className="relative max-h-[88vh] w-full max-w-md overflow-y-auto rounded-xl border border-neutral-200 bg-white p-5 shadow-xl">
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
    </div>,
    document.body,
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

type PartyForm = {
  code: string;
  tin: string;
  taxClassification: TaxClassification;
  registeredName: string;
  lastName: string;
  firstName: string;
  middleName: string;
  tradeName: string;
  customerType: CustomerType;
  vendorType: VendorType;
  registrationType: RegistrationType;
  position: string;
  address: string;
  barangay: string;
  district: string;
  city: string;
  province: string;
  zipCode: string;
  telNo: string;
  cellNo: string;
  email: string;
  faxNo: string;
  website: string;
};

function emptyPartyForm(): PartyForm {
  return {
    code: "", tin: "", taxClassification: "NON_INDIVIDUAL", registeredName: "",
    lastName: "", firstName: "", middleName: "", tradeName: "", customerType: "PRIVATE",
    vendorType: "SUPPLIER", registrationType: "VAT", position: "", address: "", barangay: "", district: "",
    city: "", province: "", zipCode: "", telNo: "", cellNo: "", email: "", faxNo: "", website: "",
  };
}

/**
 * Full "create a party" form used inline from the transaction screens — the
 * same field set as the Agents page, so a record can be captured completely
 * without leaving the transaction.
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
  const [form, setForm] = useState<PartyForm>(emptyPartyForm());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof PartyForm>(key: K, value: PartyForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);

    const ep = PARTY_ENDPOINT[type];
    const payload: Record<string, unknown> = {
      companyId,
      code: form.code.trim(),
      tin: form.tin.trim() || null,
      address: form.address.trim() || null,
      barangay: form.barangay.trim() || null,
      district: form.district.trim() || null,
      city: form.city.trim() || null,
      province: form.province.trim() || null,
      zipCode: form.zipCode.trim() || null,
      telNo: form.telNo.trim() || null,
      cellNo: form.cellNo.trim() || null,
      email: form.email.trim() || null,
    };

    if (isEmployee) {
      payload.lastName = form.lastName.trim();
      payload.firstName = form.firstName.trim();
      payload.middleName = form.middleName.trim() || null;
      payload.position = form.position.trim() || null;
    } else {
      payload.taxClassification = form.taxClassification;
      payload.registeredName = form.registeredName.trim() || null;
      payload.lastName = form.lastName.trim() || null;
      payload.firstName = form.firstName.trim() || null;
      payload.middleName = form.middleName.trim() || null;
      payload.tradeName = form.tradeName.trim();
      payload.registrationType = form.registrationType;
      payload.faxNo = form.faxNo.trim() || null;
      payload.website = form.website.trim() || null;
      if (type === "CUSTOMER") payload.customerType = form.customerType;
      if (type === "VENDOR") payload.vendorType = form.vendorType;
    }

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
        Code <span className="text-neutral-400">(optional)</span>
        <input
          autoFocus
          value={form.code}
          onChange={(e) => set("code", e.target.value)}
          placeholder="Auto-assigned if blank"
          className={`${field} font-mono`}
        />
      </label>

      <label className={labelCls}>
        TIN
        <TinInput value={form.tin} onChange={(v) => set("tin", v)} className={field} />
      </label>

      {isEmployee ? (
        <>
          <div className="grid grid-cols-2 gap-3">
            <label className={labelCls}>
              Last name
              <input required value={form.lastName} onChange={(e) => set("lastName", e.target.value)} className={field} />
            </label>
            <label className={labelCls}>
              First name
              <input required value={form.firstName} onChange={(e) => set("firstName", e.target.value)} className={field} />
            </label>
          </div>
          <label className={labelCls}>
            Middle name
            <input value={form.middleName} onChange={(e) => set("middleName", e.target.value)} className={field} />
          </label>
          <label className={labelCls}>
            Position
            <input value={form.position} onChange={(e) => set("position", e.target.value)} className={field} />
          </label>
        </>
      ) : (
        <>
          <label className={labelCls}>
            Tax classification
            <select
              value={form.taxClassification}
              onChange={(e) => set("taxClassification", e.target.value as TaxClassification)}
              className={field}
            >
              {Object.entries(TAX_CLASSIFICATION_LABELS).map(([value, text]) => (
                <option key={value} value={value}>{text}</option>
              ))}
            </select>
          </label>

          {form.taxClassification === "NON_INDIVIDUAL" ? (
            <label className={labelCls}>
              Registered Name
              <input required value={form.registeredName} onChange={(e) => set("registeredName", e.target.value)} className={field} />
            </label>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <label className={labelCls}>
                Last name
                <input required value={form.lastName} onChange={(e) => set("lastName", e.target.value)} className={field} />
              </label>
              <label className={labelCls}>
                First name
                <input required value={form.firstName} onChange={(e) => set("firstName", e.target.value)} className={field} />
              </label>
            </div>
          )}

          <label className={labelCls}>
            Trade Name
            <input required value={form.tradeName} onChange={(e) => set("tradeName", e.target.value)} className={field} />
          </label>

          {type === "CUSTOMER" && (
            <label className={labelCls}>
              Customer type
              <select value={form.customerType} onChange={(e) => set("customerType", e.target.value as CustomerType)} className={field}>
                {Object.entries(CUSTOMER_TYPE_LABELS).map(([value, text]) => (
                  <option key={value} value={value}>{text}</option>
                ))}
              </select>
            </label>
          )}

          {type === "VENDOR" && (
            <label className={labelCls}>
              Vendor type
              <select value={form.vendorType} onChange={(e) => set("vendorType", e.target.value as VendorType)} className={field}>
                {Object.entries(VENDOR_TYPE_LABELS).map(([value, text]) => (
                  <option key={value} value={value}>{text}</option>
                ))}
              </select>
            </label>
          )}

          <label className={labelCls}>
            Registration type
            <select value={form.registrationType} onChange={(e) => set("registrationType", e.target.value as RegistrationType)} className={field}>
              {Object.entries(REGISTRATION_TYPE_LABELS).map(([value, text]) => (
                <option key={value} value={value}>{text}</option>
              ))}
            </select>
          </label>
        </>
      )}

      <AddressFields
        idPrefix={`qc-${type.toLowerCase()}`}
        value={{
          street: form.address,
          barangay: form.barangay,
          district: form.district,
          province: form.province,
          city: form.city,
          zip: form.zipCode,
        }}
        onChange={(patch) => {
          if (patch.street !== undefined) set("address", patch.street);
          if (patch.barangay !== undefined) set("barangay", patch.barangay);
          if (patch.district !== undefined) set("district", patch.district);
          if (patch.province !== undefined) set("province", patch.province);
          if (patch.city !== undefined) set("city", patch.city);
          if (patch.zip !== undefined) set("zipCode", patch.zip);
        }}
      />

      <div className="grid grid-cols-2 gap-3">
        <label className={labelCls}>
          Tel no.
          <input value={form.telNo} onChange={(e) => set("telNo", e.target.value)} className={field} />
        </label>
        <label className={labelCls}>
          Cell no.
          <input value={form.cellNo} onChange={(e) => set("cellNo", e.target.value)} className={field} />
        </label>
      </div>
      <label className={labelCls}>
        Email
        <input value={form.email} onChange={(e) => set("email", e.target.value)} className={field} />
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
