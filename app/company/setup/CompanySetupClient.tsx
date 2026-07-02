"use client";

import { useState } from "react";
import type { Company, PeriodType, RegistrationType, TaxClassification } from "@prisma/client";
import {
  MONTHS,
  PERIOD_TYPE_LABELS,
  REGISTRATION_TYPE_LABELS,
  TAX_CLASSIFICATION_LABELS,
  type CompanyFormPayload,
} from "@/lib/company";

function toFormState(company: Company | null): CompanyFormPayload {
  return {
    tin: company?.tin ?? "",
    taxClassification: company?.taxClassification ?? "NON_INDIVIDUAL",
    registeredName: company?.registeredName ?? "",
    taxpayerLastName: company?.taxpayerLastName ?? "",
    taxpayerFirstName: company?.taxpayerFirstName ?? "",
    taxpayerMiddleName: company?.taxpayerMiddleName ?? "",
    tradeName: company?.tradeName ?? "",
    businessAddress: company?.businessAddress ?? "",
    zipCode: company?.zipCode ?? "",
    rdoCode: company?.rdoCode ?? "",
    periodType: company?.periodType ?? "CALENDAR",
    fiscalMonthEnd: company?.fiscalMonthEnd ?? 12,
    businessType: company?.businessType ?? "",
    registrationType: company?.registrationType ?? "VAT",
    lineOfBusiness: company?.lineOfBusiness ?? "",
    telNo: company?.telNo ?? "",
    faxNo: company?.faxNo ?? "",
    authorizedRep: company?.authorizedRep ?? "",
    authorizedRepPosition: company?.authorizedRepPosition ?? "",
  };
}

export function CompanySetupClient({ initialCompany }: { initialCompany: Company | null }) {
  const [company, setCompany] = useState(initialCompany);
  const [form, setForm] = useState<CompanyFormPayload>(toFormState(initialCompany));
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  function set<K extends keyof CompanyFormPayload>(key: K, value: CompanyFormPayload[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);

    const res = await fetch("/api/company", {
      method: company ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    setSaving(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong saving the company.");
      return;
    }

    const data = await res.json();
    setCompany(data.company);
    setSaved(true);
  }

  const field = "mt-1 w-full rounded border border-neutral-300 px-2 py-1.5 text-sm";
  const label = "block text-xs text-neutral-500";

  return (
    <main className="mx-auto max-w-3xl p-8">
      <h1 className="text-xl font-medium text-neutral-900">
        {company ? "Company settings" : "Set up your company"}
      </h1>
      <p className="mt-1 text-sm text-neutral-500">
        This information appears on BIR forms and certificates, so it's worth getting right the
        first time.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-6">
        {/* TIN + Tax Classification */}
        <div className="grid grid-cols-2 gap-4">
          <label className={label}>
            TIN
            <input
              required
              value={form.tin}
              onChange={(e) => set("tin", e.target.value)}
              placeholder="000-065-432"
              className={field}
            />
          </label>
          <label className={label}>
            Taxpayer classification
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
        </div>

        {/* Registered Name / Taxpayer Name — conditional on classification */}
        {form.taxClassification === "NON_INDIVIDUAL" ? (
          <label className={label}>
            Registered name
            <input
              required
              value={form.registeredName ?? ""}
              onChange={(e) => set("registeredName", e.target.value)}
              className={field}
            />
          </label>
        ) : (
          <div className="grid grid-cols-3 gap-4">
            <label className={label}>
              Last name
              <input
                required
                value={form.taxpayerLastName ?? ""}
                onChange={(e) => set("taxpayerLastName", e.target.value)}
                className={field}
              />
            </label>
            <label className={label}>
              First name
              <input
                required
                value={form.taxpayerFirstName ?? ""}
                onChange={(e) => set("taxpayerFirstName", e.target.value)}
                className={field}
              />
            </label>
            <label className={label}>
              Middle name
              <input
                value={form.taxpayerMiddleName ?? ""}
                onChange={(e) => set("taxpayerMiddleName", e.target.value)}
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

        {/* Address */}
        <div className="grid grid-cols-[1fr_140px] gap-4">
          <label className={label}>
            Business address
            <input
              required
              value={form.businessAddress}
              onChange={(e) => set("businessAddress", e.target.value)}
              placeholder="Street/Brgy., City/Municipality"
              className={field}
            />
          </label>
          <label className={label}>
            Zip code
            <input
              required
              value={form.zipCode}
              onChange={(e) => set("zipCode", e.target.value)}
              className={field}
            />
          </label>
        </div>

        {/* RDO + Period */}
        <div className="grid grid-cols-2 gap-4">
          <label className={label}>
            RDO code
            <input
              required
              value={form.rdoCode}
              onChange={(e) => set("rdoCode", e.target.value)}
              placeholder="113 - DAVAO CITY"
              className={field}
            />
          </label>
          <label className={label}>
            Period type
            <select
              value={form.periodType}
              onChange={(e) => set("periodType", e.target.value as PeriodType)}
              className={field}
            >
              {Object.entries(PERIOD_TYPE_LABELS).map(([value, text]) => (
                <option key={value} value={value}>
                  {text}
                </option>
              ))}
            </select>
          </label>
        </div>

        {form.periodType === "FISCAL" && (
          <label className={label}>
            Fiscal month end
            <select
              value={form.fiscalMonthEnd ?? 12}
              onChange={(e) => set("fiscalMonthEnd", Number(e.target.value))}
              className={field}
            >
              {MONTHS.map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}
                </option>
              ))}
            </select>
          </label>
        )}

        {/* Business type + Registration type */}
        <div className="grid grid-cols-2 gap-4">
          <label className={label}>
            Business type (optional)
            <input
              value={form.businessType ?? ""}
              onChange={(e) => set("businessType", e.target.value)}
              placeholder="Corporation, Partnership, ..."
              className={field}
            />
          </label>
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
          </label>
        </div>

        <label className={label}>
          Line of business (optional)
          <input
            value={form.lineOfBusiness ?? ""}
            onChange={(e) => set("lineOfBusiness", e.target.value)}
            className={field}
          />
        </label>

        {/* Contact */}
        <div className="grid grid-cols-2 gap-4">
          <label className={label}>
            Telephone no. (optional)
            <input
              value={form.telNo ?? ""}
              onChange={(e) => set("telNo", e.target.value)}
              className={field}
            />
          </label>
          <label className={label}>
            Fax (optional)
            <input
              value={form.faxNo ?? ""}
              onChange={(e) => set("faxNo", e.target.value)}
              className={field}
            />
          </label>
        </div>

        {/* Authorized representative */}
        <div className="grid grid-cols-2 gap-4">
          <label className={label}>
            Authorized representative (optional)
            <input
              value={form.authorizedRep ?? ""}
              onChange={(e) => set("authorizedRep", e.target.value)}
              className={field}
            />
          </label>
          <label className={label}>
            Position (optional)
            <input
              value={form.authorizedRepPosition ?? ""}
              onChange={(e) => set("authorizedRepPosition", e.target.value)}
              className={field}
            />
          </label>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        {saved && <p className="text-sm text-green-600">Saved.</p>}

        <button
          type="submit"
          disabled={saving}
          className="rounded bg-neutral-900 px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          {saving ? "Saving…" : company ? "Save changes" : "Create company"}
        </button>
      </form>
    </main>
  );
}
