"use client";

import { useEffect } from "react";

// Print/Close bar for voucher pages. Auto-triggers the browser print dialog
// shortly after mount (so "Save & Print" flows straight to printing), and hides
// itself on the printed output.
export function PrintControls({ auto = true }: { auto?: boolean }) {
  useEffect(() => {
    if (!auto) return;
    const t = setTimeout(() => window.print(), 400);
    return () => clearTimeout(t);
  }, [auto]);

  return (
    <div className="mb-4 flex gap-2 print:hidden">
      <button onClick={() => window.print()} className="rounded bg-[#0B2A5E] px-4 py-2 text-sm text-white hover:bg-[#123A73]">Print</button>
      <button onClick={() => window.close()} className="rounded border border-neutral-300 px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-50">Close</button>
    </div>
  );
}
