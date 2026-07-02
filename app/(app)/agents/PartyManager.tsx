"use client";

import { useState } from "react";
import type { CustomerType, RegistrationType, TaxClassification, VendorType } from "@prisma/client";
import { TAX_CLASSIFICATION_LABELS, REGISTRATION_TYPE_LABELS } from "@/lib/company";
import { CUSTOMER_TYPE_LABELS, VENDOR_TYPE_LABELS, PARTY_LABELS, type PartyEntityType } from "@/lib/parties";

// The four models (Customer/Vendor/Employee/Contact) share most fields but
// not all — Employee has no taxClassification/tradeName/registrationType,
// only Customer has customerType, only Vendor has vendorType. Rather than
// four near-duplicate components, this one takes entityType and renders
// the fields that apply, loosely typed as PartyRecord since no single
// Prisma type covers all four shapes.
type PartyRecord = {
  id: string;
  code: string;
  tin?: string | null;
  taxClassification?: TaxClassification;
  registeredName?: string | null;
  lastName?: string | null;
  firstName?: string | null;
  middleName?: string | null;
  tradeName?: string | null;
  customerType?: CustomerType;
  vendorType?: VendorType;
  registrationType?: RegistrationType;
  position?: string | null;
  address?: string | null;
  telNo?: string | null;
  faxNo?: string | null;
  cellNo?: string | null;
  email?: string | null;
  website?: string | null;
  isActive: boolean;
};

type FormState = {
  mode: "create" | "edit";
  id?: string;
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
  telNo: string;
  faxNo: string;
  cellNo: string;
  email: string;
  website: string;
  isActive: boolean;
};

function emptyForm(): FormState {
  return {
    mode: "create",
    code: "",
    tin: "",
    taxClassification: "NON_INDIVIDUAL",
    registeredName: "",
    lastName: "",
    firstName: "",
    middleName: "",
    tradeName: "",
    customerType: "PRIVATE",
    vendorType: "SUPPLIER",
    registrationType: "VAT",
    position: "",
    address: "",
    telNo: "",
    faxNo: "",
    cellNo: "",
    email: "",
    website: "",
    isActive: true,
  };
}

function toForm(record: PartyRecord): FormState {
  return {
    mode: "edit",
    id: record.id,
    code: record.code,
    tin: record.tin ?? "",
    taxClassification: record.taxClassification ?? "NON_INDIVIDUAL",
    registeredName: record.registeredName ?? "",
    lastName: record.lastName ?? "",
    firstName: record.firstName ?? "",
    middleName: record.middleName ?? "",
    tradeName: record.tradeName ?? "",
    customerType: record.customerType ?? "PRIVATE",
    vendorType: record.vendorType ?? "SUPPLIER",
    registrationType: record.registrationType ?? "VAT",
    position: record.position ?? "",
    address: record.address ?? "",
    telNo: record.telNo ?? "",
    faxNo: record.faxNo ?? "",
    cellNo: record.cellNo ?? "",
    email: record.email ?? "",
    website: record.website ?? "",
    isActive: record.isActive,
  };
}

export function PartyManager({
  entityType,
  companyId,
  initialItems,
}: {
  entityType: PartyEntityType;
  companyId: string;
  initialItems: PartyRecord[];
}) {
  const [items, setItems] = useState<PartyRecord[]>(initialItems);
  const [form, setForm] = useState<FormState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const { plural, apiBase, responseKey } = PARTY_LABELS[entityType];
  const isEmployee = entityType === "employee";

  async function refresh() {
    const res = await fetch(`${apiBase}?companyId=${companyId}`);
    const data = await res.json();
    setItems(data[responseKey] ?? []);
  }

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    if (!form) return;
    setForm({ ...form, [key]: value });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setSaving(true);
    setError(null);

    const payload: Record<string, unknown> = {
      companyId,
      code: form.code.trim(),
      tin: form.tin.trim() || null,
      address: form.address.trim() || null,
      telNo: form.telNo.trim() || null,
      cellNo: form.cellNo.trim() || null,
      email: form.email.trim() || null,
      isActive: form.isActive,
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
      if (entityType === "customer") payload.customerType = form.customerType;
      if (entityType === "vendor") payload.vendorType = form.vendorType;
    }

    const url = form.mode === "create" ? apiBase : `${apiBase}/${form.id}`;
    const method = form.mode === "create" ? "POST" : "PATCH";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    setSaving(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong saving this record.");
      return;
    }

    setForm(null);
    await refresh();
  }

  async function handleDelete(record: PartyRecord) {
    const displayName = record.tradeName || `${record.firstName ?? ""} ${record.lastName ?? ""}`.trim();
    if (!window.confirm(`Delete "${displayName}" (${record.code})? This can't be undone.`)) return;

    const res = await fetch(`${apiBase}/${record.id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Couldn't delete this record.");
      return;
    }
    if (form?.id === record.id) setForm(null);
    await refresh();
  }

  const field = "mt-1 w-full rounded border border-neutral-300 px-2 py-1.5 text-sm";
  const label = "block text-xs text-neutral-500";

  return (
    <div className="grid grid-cols-[1fr_340px] gap-8">
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-medium uppercase tracking-wide text-neutral-500">{plural}</h2>
          <button
            onClick={() => {
              setError(null);
              setForm(emptyForm());
            }}
            className="text-xs text-neutral-500 hover:text-neutral-900"
          >
            + {PARTY_LABELS[entityType].singular.toLowerCase()}
          </button>
        </div>

        <div className="divide-y divide-neutral-100 rounded-lg border border-neutral-200">
          {items.length === 0 ? (
            <p className="px-4 py-3 text-sm text-neutral-400">No {plural.toLowerCase()} yet</p>
          ) : (
            items.map((item) => {
              const displayName =
                item.tradeName || `${item.firstName ?? ""} ${item.lastName ?? ""}`.trim();
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setError(null);
                    setForm(toForm(item));
                  }}
                  className={`flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-neutral-50 ${
                    !item.isActive ? "opacity-50" : ""
                  } ${form?.id === item.id ? "bg-neutral-50" : ""}`}
                >
                  <span className="font-mono text-sm text-neutral-500">{item.code}</span>
                  <span className="text-sm text-neutral-900">{displayName}</span>
                  {!item.isActive && <span className="text-xs text-neutral-400">(inactive)</span>}
                </button>
              );
            })
          )}
        </div>
      </section>

      <aside className="sticky top-8 self-start rounded-lg border border-neutral-200 p-4">
        {!form ? (
          <p className="text-sm text-neutral-500">
            Select a {PARTY_LABELS[entityType].singular.toLowerCase()} to edit it, or use "+{" "}
            {PARTY_LABELS[entityType].singular.toLowerCase()}" to create one.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <h3 className="text-sm font-medium text-neutral-900">
              {form.mode === "create" ? "New" : "Edit"} {PARTY_LABELS[entityType].singular.toLowerCase()}
            </h3>

            <label className={label}>
              Code
              <input
                required
                value={form.code}
                onChange={(e) => set("code", e.target.value)}
                className={`${field} font-mono`}
              />
            </label>

            <label className={label}>
              TIN
              <input value={form.tin} onChange={(e) => set("tin", e.target.value)} className={field} />
            </label>

            {isEmployee ? (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <label className={label}>
                    Last name
                    <input
                      required
                      value={form.lastName}
                      onChange={(e) => set("lastName", e.target.value)}
                      className={field}
                    />
                  </label>
                  <label className={label}>
                    First name
                    <input
                      required
                      value={form.firstName}
                      onChange={(e) => set("firstName", e.target.value)}
                      className={field}
                    />
                  </label>
                </div>
                <label className={label}>
                  Middle name
                  <input
                    value={form.middleName}
                    onChange={(e) => set("middleName", e.target.value)}
                    className={field}
                  />
                </label>
                <label className={label}>
                  Position
                  <input
                    value={form.position}
                    onChange={(e) => set("position", e.target.value)}
                    className={field}
                  />
                </label>
              </>
            ) : (
              <>
                <label className={label}>
                  Tax classification
                  <select
                    value={form.taxClassification}
                    onChange={(e) => set("taxClassification", e.target.value as TaxClassification)}
                    className={field}
                  >
                    {Object.entries(TAX_CLASSIFICATION_LABELS).map(([value, text]) => (
                      <option key={value} value={value}>
                        {text}
                      </option>
                    ))}
                  </select>
                </label>

                {form.taxClassification === "NON_INDIVIDUAL" ? (
                  <label className={label}>
                    Registered name
                    <input
                      required
                      value={form.registeredName}
                      onChange={(e) => set("registeredName", e.target.value)}
                      className={field}
                    />
                  </label>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <label className={label}>
                      Last name
                      <input
                        required
                        value={form.lastName}
                        onChange={(e) => set("lastName", e.target.value)}
                        className={field}
                      />
                    </label>
                    <label className={label}>
                      First name
                      <input
                        required
                        value={form.firstName}
                        onChange={(e) => set("firstName", e.target.value)}
                        className={field}
                      />
                    </label>
                  </div>
                )}

                <label className={label}>
                  Trade name
                  <input
                    required
                    value={form.tradeName}
                    onChange={(e) => set("tradeName", e.target.value)}
                    className={field}
                  />
                </label>

                {entityType === "customer" && (
                  <label className={label}>
                    Customer type
                    <select
                      value={form.customerType}
                      onChange={(e) => set("customerType", e.target.value as CustomerType)}
                      className={field}
                    >
                      {Object.entries(CUSTOMER_TYPE_LABELS).map(([value, text]) => (
                        <option key={value} value={value}>
                          {text}
                        </option>
                      ))}
                    </select>
                    <span className="mt-1 block text-xs text-neutral-400">
                      Government customers trigger the multiple-withholding-tax flow.
                    </span>
                  </label>
                )}

                {entityType === "vendor" && (
                  <label className={label}>
                    Vendor type
                    <select
                      value={form.vendorType}
                      onChange={(e) => set("vendorType", e.target.value as VendorType)}
                      className={field}
                    >
                      {Object.entries(VENDOR_TYPE_LABELS).map(([value, text]) => (
                        <option key={value} value={value}>
                          {text}
                        </option>
                      ))}
                    </select>
                  </label>
                )}

                <label className={label}>
                  Registration type
                  <select
                    value={form.registrationType}
                    onChange={(e) => set("registrationType", e.target.value as RegistrationType)}
                    className={field}
                  >
                    {Object.entries(REGISTRATION_TYPE_LABELS).map(([value, text]) => (
                      <option key={value} value={value}>
                        {text}
                      </option>
                    ))}
                  </select>
                  <span className="mt-1 block text-xs text-neutral-400">
                    Gates which VAT types (12%/Zero-Rated/Exempt) are offered on transactions with
                    this {PARTY_LABELS[entityType].singular.toLowerCase()}.
                  </span>
                </label>

                <label className={label}>
                  Fax (optional)
                  <input value={form.faxNo} onChange={(e) => set("faxNo", e.target.value)} className={field} />
                </label>
                <label className={label}>
                  Website (optional)
                  <input
                    value={form.website}
                    onChange={(e) => set("website", e.target.value)}
                    className={field}
                  />
                </label>
              </>
            )}

            <label className={label}>
              Address
              <input value={form.address} onChange={(e) => set("address", e.target.value)} className={field} />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className={label}>
                Tel no.
                <input value={form.telNo} onChange={(e) => set("telNo", e.target.value)} className={field} />
              </label>
              <label className={label}>
                Cell no.
                <input value={form.cellNo} onChange={(e) => set("cellNo", e.target.value)} className={field} />
              </label>
            </div>
            <label className={label}>
              Email
              <input value={form.email} onChange={(e) => set("email", e.target.value)} className={field} />
            </label>

            {form.mode === "edit" && (
              <label className="flex items-center gap-2 text-xs text-neutral-500">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => set("isActive", e.target.checked)}
                />
                Active
              </label>
            )}

            {error && <p className="text-xs text-red-600">{error}</p>}

            <div className="flex items-center gap-2 pt-2">
              <button
                type="submit"
                disabled={saving}
                className="rounded bg-[#0B2A5E] hover:bg-[#123A73] px-3 py-1.5 text-sm text-white disabled:opacity-50"
              >
                {saving ? "Saving…" : form.mode === "create" ? "Create" : "Save changes"}
              </button>
              <button
                type="button"
                onClick={() => setForm(null)}
                className="rounded px-3 py-1.5 text-sm text-neutral-500 hover:text-neutral-900"
              >
                Cancel
              </button>
              {form.mode === "edit" && (
                <button
                  type="button"
                  onClick={() => handleDelete(items.find((i) => i.id === form.id)!)}
                  className="ml-auto text-xs text-red-500 hover:text-red-700"
                >
                  Delete
                </button>
              )}
            </div>
          </form>
        )}
      </aside>
    </div>
  );
}
