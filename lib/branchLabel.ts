// A branch's display label for dropdowns / filters: "000 — Head Office" when a
// branch code is set, otherwise just the name.
export function branchOptionLabel(l: { name: string; branchCode: string | null }): string {
  const code = (l.branchCode ?? "").replace(/\D/g, "");
  return code ? `${code.padStart(5, "0")} — ${l.name}` : l.name;
}
