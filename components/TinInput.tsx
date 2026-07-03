"use client";

import { useState } from "react";
import { formatTin, isValidTin } from "@/lib/tin";

/**
 * TIN text input that auto-formats to 000-000-000-000 as you type and flags an
 * invalid format on blur. Emits the formatted string via onChange.
 */
export function TinInput({
  value,
  onChange,
  disabled = false,
  required = false,
  className,
  placeholder = "000-000-000-00000",
}: {
  value: string;
  onChange: (formatted: string) => void;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  placeholder?: string;
}) {
  const [touched, setTouched] = useState(false);
  const invalid = touched && value.trim().length > 0 && !isValidTin(value);

  return (
    <>
      <input
        inputMode="numeric"
        required={required}
        disabled={disabled}
        value={value}
        onChange={(e) => onChange(formatTin(e.target.value))}
        onBlur={() => setTouched(true)}
        placeholder={placeholder}
        aria-invalid={invalid}
        className={`${className ?? ""} ${invalid ? "border-red-400" : ""}`}
      />
      {invalid && (
        <span className="mt-1 block text-xs text-red-600">
          Enter 9 digits (optionally + a 3- or 5-digit branch code).
        </span>
      )}
    </>
  );
}
