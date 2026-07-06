import { useCallback, useEffect, useState } from "react";

type BranchLike = { id: string; isDefault: boolean };

/**
 * Branch (Location) selector state for transaction forms that remembers the
 * last branch the user picked. The choice is stored per company in
 * localStorage, so the next document defaults to where they were working.
 *
 * To avoid a hydration mismatch, the first render uses the company's default
 * branch (server-safe); the saved branch is applied on mount. The returned
 * setter persists every change, so `<select onChange={setLocationId}>` keeps
 * working unchanged.
 */
export function useLastBranch(
  companyId: string,
  locations: BranchLike[]
): readonly [string, (id: string) => void] {
  const fallback = locations.find((l) => l.isDefault)?.id ?? "";
  const [locationId, setLocationId] = useState(fallback);
  const storageKey = `arbixo:lastBranch:${companyId}`;

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      // Only restore a branch that still exists for this company.
      if (saved && locations.some((l) => l.id === saved)) setLocationId(saved);
    } catch {
      // ignore unavailable / malformed storage
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  const setAndRemember = useCallback(
    (id: string) => {
      setLocationId(id);
      try {
        localStorage.setItem(storageKey, id);
      } catch {
        // ignore storage write failures (private mode, quota)
      }
    },
    [storageKey]
  );

  return [locationId, setAndRemember] as const;
}
