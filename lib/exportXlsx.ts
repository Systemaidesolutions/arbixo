// Client helper: POST a plain grid of rows (the same array a report used to
// build a CSV) to the generic /api/export/xlsx endpoint and download the real
// .xlsx it returns. Amount cells (2-decimal strings like "1234.56") are turned
// into numbers by the server; codes / TINs / dates stay as text.
export async function downloadXlsx(
  filename: string,
  sheetName: string,
  rows: (string | number | null | undefined)[][],
): Promise<void> {
  const res = await fetch("/api/export/xlsx", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filename, sheetName, rows }),
  });
  if (!res.ok) {
    alert("Export failed. Please try again.");
    return;
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.toLowerCase().endsWith(".xlsx") ? filename : `${filename}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
