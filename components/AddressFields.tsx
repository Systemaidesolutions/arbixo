"use client";

import { PROVINCES, citiesOf, zipsOf } from "@/lib/ph-locations";
import { sanitizeText } from "@/lib/textValidation";

export type AddressValue = {
  street: string;
  barangay: string;
  province: string;
  city: string;
  zip: string;
};

/**
 * Standard PH address block with cascading, smart-filtered dropdowns:
 * Province -> City/Municipality (filtered) -> Zip (auto-filled, editable via a
 * suggestion list). Street/building line and barangay are free text. Fully
 * controlled: the parent holds the values and receives partial patches.
 */
export function AddressFields({
  value,
  onChange,
  disabled = false,
  required = false,
  streetLabel = "Street / Building No.",
  idPrefix = "addr",
}: {
  value: AddressValue;
  onChange: (patch: Partial<AddressValue>) => void;
  disabled?: boolean;
  required?: boolean;
  streetLabel?: string;
  idPrefix?: string;
}) {
  const field =
    "mt-1 w-full rounded border border-neutral-300 px-2 py-1.5 text-sm disabled:cursor-default disabled:bg-neutral-50 disabled:text-neutral-600";
  const label = "block text-xs text-neutral-500";

  const cities = value.province ? citiesOf(value.province) : [];
  const zipOptions = value.province && value.city ? zipsOf(value.province, value.city) : [];

  return (
    <div className="space-y-3">
      <label className={label}>
        {streetLabel}
        <input
          required={required}
          disabled={disabled}
          value={value.street}
          onChange={(e) => onChange({ street: sanitizeText(e.target.value) })}
          placeholder="Unit / House No., Street"
          className={field}
        />
      </label>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className={label}>
          Province
          <select
            required={required}
            disabled={disabled}
            value={value.province}
            onChange={(e) => onChange({ province: e.target.value, city: "", zip: "" })}
            className={field}
          >
            <option value="">Select province…</option>
            {PROVINCES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>

        <label className={label}>
          City / Municipality
          <select
            required={required}
            disabled={disabled || !value.province}
            value={value.city}
            onChange={(e) => {
              const zips = zipsOf(value.province, e.target.value);
              onChange({ city: e.target.value, zip: zips[0] ?? "" });
            }}
            className={field}
          >
            <option value="">{value.province ? "Select city…" : "Select province first"}</option>
            {cities.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className={label}>
          Barangay
          <input
            disabled={disabled}
            value={value.barangay}
            onChange={(e) => onChange({ barangay: sanitizeText(e.target.value) })}
            placeholder="Barangay"
            className={field}
          />
        </label>

        <label className={label}>
          Zip code
          <input
            required={required}
            disabled={disabled}
            value={value.zip}
            onChange={(e) => onChange({ zip: e.target.value })}
            list={`${idPrefix}-zips`}
            inputMode="numeric"
            placeholder="0000"
            className={field}
          />
          <datalist id={`${idPrefix}-zips`}>
            {zipOptions.map((z) => (
              <option key={z} value={z} />
            ))}
          </datalist>
        </label>
      </div>
    </div>
  );
}
