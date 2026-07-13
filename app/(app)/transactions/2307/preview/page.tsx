"use client";

import { useEffect, useState } from "react";
import { Form2307, type Form2307Data } from "@/components/Form2307";

// Prints a 2307 from UNSAVED form data. The originating form stashes the
// payload in localStorage under this key, opens this page in a new tab, and
// the page renders + prints it (then clears the key).
const PREVIEW_2307_KEY = "arbixo_2307_preview";

export default function Form2307PreviewPage() {
  const [data, setData] = useState<Form2307Data | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(PREVIEW_2307_KEY);
      if (!raw) {
        setMissing(true);
        return;
      }
      setData(JSON.parse(raw) as Form2307Data);
      localStorage.removeItem(PREVIEW_2307_KEY);
    } catch {
      setMissing(true);
    }
  }, []);

  if (missing) {
    return (
      <main className="mx-auto max-w-md p-8 text-sm text-neutral-600">
        Nothing to preview. Open this from the Print 2307 button on a transaction form.
      </main>
    );
  }
  if (!data) return null;
  return <Form2307 data={data} />;
}
