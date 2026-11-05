"use client";

import { useEffect } from "react";

// Hides Print / Export / Import buttons for users whose access groups
// (Admin › User access, lib/userPermissions.ts) don't include them. The
// buttons across reports, books and transaction forms share the same labels
// ("Print…", "Export…", "Import from Excel"), so this matches on the label
// rather than touching every screen. It's only cosmetic: middleware.ts and
// the app layout block the actual print pages, exports and imports, and the
// print CSS below stops Ctrl+P on screens that use the browser's print.
const RULES: { key: string; test: RegExp }[] = [
  { key: "printReports", test: /^print\b/i },
  { key: "exportFiles", test: /^export\b/i },
  { key: "importTransactions", test: /^import from excel\b/i },
];

export function AccessHider({ denied }: { denied: string[] }) {
  const rules = RULES.filter((r) => denied.includes(r.key));
  const key = rules.map((r) => r.key).join(",");

  useEffect(() => {
    if (!rules.length) return;
    const hide = () => {
      document.querySelectorAll<HTMLElement>("button, a").forEach((el) => {
        if (el.dataset.accessHidden) return;
        const text = (el.textContent ?? "").replace(/\s+/g, " ").trim();
        if (text && rules.some((r) => r.test.test(text))) {
          el.dataset.accessHidden = "1";
          el.style.display = "none";
        }
      });
    };
    hide();
    const obs = new MutationObserver(hide);
    obs.observe(document.body, { childList: true, subtree: true, characterData: true });
    return () => obs.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (!denied.includes("printReports")) return null;
  return (
    <style>{`@media print { body * { visibility: hidden !important; } body::after { content: "Printing is turned off for your account."; visibility: visible; position: fixed; top: 1in; left: 1in; font: 14pt sans-serif; } }`}</style>
  );
}
