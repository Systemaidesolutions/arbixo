"use client";

import type { PeriodType, RegistrationType, TaxClassification } from "@prisma/client";
import {
  MONTHS,
  PERIOD_TYPE_LABELS,
  REGISTRATION_TYPE_LABELS,
  TAX_CLASSIFICATION_LABELS,
  type CompanyFormPayload,
} from "@/lib/company";
import { TinInput } from "@/components/TinInput";
import { AddressFields } from "@/components/AddressFields";
import { RdoSelect } from "@/components/RdoSelect";

/**
 * The full BIR company field set (manual section 1.1), shared by the admin
 * create/edit form and the subscriber read-only view. Pass `readOnly` to
 * render it as a locked view — subscribers can see their company details
 * but only an admin can change them.
 */
export function CompanyFields({
  form,
  onChange,
  readOnly = false,
}: {
  form: CompanyFormPayload;
  onChange: <K extends keyof CompanyFormPayload>(key: K, value: CompanyFormPayload[K]) => void;
  readOnly?: boolean;
}) {
  const field =
    "mt-1 w-full rounded border border-neutral-300 px-2 py-1.5 text-sm disabled:cursor-default disabled:bg-neutral-50 disabled:text-neutral-600";
  const label = "block text-xs text-neutral-500";

  return (
    <div className="space-y-6">
      {/* TIN + Tax Classification */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className={label}>
          TIN
          <TinInput
            required
            disabled={readOnly}
            value={form.tin}
            onChange={(v) => onChange("tin", v)}
            className={field}
          />
        </label>
        <label className={label}>
          Taxpayer classification
          <select
            disabled={readOnly}
            value={form.taxClassification}
            onChange={(e) => onChange("taxClassification", e.target.value as TaxClassification)}
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
          Registered Name
          <input
            required
            disabled={readOnly}
            value={form.registeredName ?? ""}
            onChange={(e) => onChange("registeredName", e.target.value)}
            className={field}
          />
        </label>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <label className={label}>
            Last name
            <input
              required
              disabled={readOnly}
              value={form.taxpayerLastName ?? ""}
              onChange={(e) => onChange("taxpayerLastName", e.target.value)}
              className={field}
            />
          </label>
          <label className={label}>
            First name
            <input
              required
              disabled={readOnly}
              value={form.taxpayerFirstName ?? ""}
              onChange={(e) => onChange("taxpayerFirstName", e.target.value)}
              className={field}
            />
          </label>
          <label className={label}>
            Middle name
            <input
              disabled={readOnly}
              value={form.taxpayerMiddleName ?? ""}
              onChange={(e) => onChange("taxpayerMiddleName", e.target.value)}
              className={field}
            />
          </label>
        </div>
      )}

      <label className={label}>
        Trade Name
        <input
          required
          disabled={readOnly}
          value={form.tradeName}
          onChange={(e) => onChange("tradeName", e.target.value)}
          className={field}
        />
      </label>

      {/* Address */}
      <AddressFields
        disabled={readOnly}
        required
        streetLabel="Business address (street / building)"
        idPrefix="company-addr"
        value={{
          street: form.businessAddress,
          barangay: form.barangay ?? "",
          province: form.province ?? "",
          city: form.city ?? "",
          zip: form.zipCode,
        }}
        onChange={(patch) => {
          if (patch.street !== undefined) onChange("businessAddress", patch.street);
          if (patch.barangay !== undefined) onChange("barangay", patch.barangay);
          if (patch.province !== undefined) onChange("province", patch.province);
          if (patch.city !== undefined) onChange("city", patch.city);
          if (patch.zip !== undefined) onChange("zipCode", patch.zip);
        }}
      />

      {/* RDO + Period */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className={label}>
          RDO code
          <RdoSelect
            required
            disabled={readOnly}
            value={form.rdoCode}
            onChange={(v) => onChange("rdoCode", v)}
            className={field}
          />
        </label>
        <label className={label}>
          Period type
          <select
            disabled={readOnly}
            value={form.periodType}
            onChange={(e) => onChange("periodType", e.target.value as PeriodType)}
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
            disabled={readOnly}
            value={form.fiscalMonthEnd ?? 12}
            onChange={(e) => onChange("fiscalMonthEnd", Number(e.target.value))}
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
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className={label}>
          Business type (optional)
          <input
            disabled={readOnly}
            value={form.businessType ?? ""}
            onChange={(e) => onChange("businessType", e.target.value)}
            placeholder="Corporation, Partnership, ..."
            className={field}
          />
        </label>
        <label className={label}>
          Registration type
          <select
            disabled={readOnly}
            value={form.registrationType}
            onChange={(e) => onChange("registrationType", e.target.value as RegistrationType)}
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
          disabled={readOnly}
          value={form.lineOfBusiness ?? ""}
          onChange={(e) => onChange("lineOfBusiness", e.target.value)}
          className={field}
        />
      </label>

      {/* Contact */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className={label}>
          Telephone no. (optional)
          <input
            disabled={readOnly}
            value={form.telNo ?? ""}
            onChange={(e) => onChange("telNo", e.target.value)}
            className={field}
          />
        </label>
        <label className={label}>
          Fax (optional)
          <input
            disabled={readOnly}
            value={form.faxNo ?? ""}
            onChange={(e) => onChange("faxNo", e.target.value)}
            className={field}
          />
        </label>
        <label className={label}>
          Website (optional)
          <input
            disabled={readOnly}
            value={form.website ?? ""}
            onChange={(e) => onChange("website", e.target.value)}
            placeholder="www.example.com"
            className={field}
          />
        </label>
        <label className={label}>
          Email (optional)
          <input
            disabled={readOnly}
            type="email"
            value={form.email ?? ""}
            onChange={(e) => onChange("email", e.target.value)}
            placeholder="info@example.com"
            className={field}
          />
        </label>
      </div>

      {/* Authorized representative */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className={label}>
          Authorized representative (optional)
          <input
            disabled={readOnly}
            value={form.authorizedRep ?? ""}
            onChange={(e) => onChange("authorizedRep", e.target.value)}
            className={field}
          />
        </label>
        <label className={label}>
          Position (optional)
          <input
            disabled={readOnly}
            value={form.authorizedRepPosition ?? ""}
            onChange={(e) => onChange("authorizedRepPosition", e.target.value)}
            className={field}
          />
        </label>
      </div>
    </div>
  );
}

export function toCompanyFormState(
  company: Partial<CompanyFormPayload> | null
): CompanyFormPayload {
  return {
    tin: company?.tin ?? "",
    taxClassification: company?.taxClassification ?? "NON_INDIVIDUAL",
    registeredName: company?.registeredName ?? "",
    taxpayerLastName: company?.taxpayerLastName ?? "",
    taxpayerFirstName: company?.taxpayerFirstName ?? "",
    taxpayerMiddleName: company?.taxpayerMiddleName ?? "",
    tradeName: company?.tradeName ?? "",
    businessAddress: company?.businessAddress ?? "",
    barangay: company?.barangay ?? "",
    city: company?.city ?? "",
    province: company?.province ?? "",
    zipCode: company?.zipCode ?? "",
    rdoCode: company?.rdoCode ?? "",
    periodType: company?.periodType ?? "CALENDAR",
    fiscalMonthEnd: company?.fiscalMonthEnd ?? 12,
    businessType: company?.businessType ?? "",
    registrationType: company?.registrationType ?? "VAT",
    lineOfBusiness: company?.lineOfBusiness ?? "",
    telNo: company?.telNo ?? "",
    faxNo: company?.faxNo ?? "",
    website: company?.website ?? "",
    email: company?.email ?? "",
    authorizedRep: company?.authorizedRep ?? "",
    authorizedRepPosition: company?.authorizedRepPosition ?? "",
  };
}
