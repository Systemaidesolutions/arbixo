import type { ReactNode } from "react";

// Minimal markdown renderer for trusted, in-repo text (e.g. the payroll user
// manual). Supports ## / ### headings, paragraphs, **bold**, "1." and "-"
// lists and pipe tables. No HTML passthrough, so nothing is injected.

export const headingId = (text: string) =>
  text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** The ## headings, for a table of contents. */
export function markdownSections(md: string): { id: string; title: string }[] {
  return md
    .split("\n")
    .filter((l) => l.startsWith("## "))
    .map((l) => ({ id: headingId(l.slice(3)), title: l.slice(3).trim() }));
}

function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean).map((part, i) =>
    part.startsWith("**") && part.endsWith("**")
      ? <strong key={i} className="font-semibold text-neutral-900">{part.slice(2, -2)}</strong>
      : part,
  );
}

const cells = (row: string) => row.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());

export function SimpleMarkdown({ source }: { source: string }) {
  const lines = source.replace(/\r\n/g, "\n").trim().split("\n");
  const out: ReactNode[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    const key = out.length;

    if (line.startsWith("## ")) {
      const t = line.slice(3).trim();
      out.push(<h2 key={key} id={headingId(t)} className="mt-10 scroll-mt-4 border-b border-neutral-200 pb-2 text-lg font-semibold text-neutral-900 first:mt-0">{t}</h2>);
      i++; continue;
    }
    if (line.startsWith("### ")) {
      const t = line.slice(4).trim();
      out.push(<h3 key={key} id={headingId(t)} className="mt-6 scroll-mt-4 text-sm font-semibold text-neutral-800">{t}</h3>);
      i++; continue;
    }
    if (line.trim().startsWith("|")) {
      const rows: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) rows.push(lines[i++]);
      const [head, , ...body] = rows; // second row is the --- separator
      out.push(
        <div key={key} className="mt-3 overflow-x-auto rounded border border-neutral-200">
          <table className="w-full text-left text-sm">
            <thead className="bg-neutral-50 text-xs text-neutral-600">
              <tr>{cells(head).map((c, j) => <th key={j} className="px-3 py-2 font-medium">{inline(c)}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {body.map((r, ri) => (
                <tr key={ri}>{cells(r).map((c, j) => <td key={j} className="px-3 py-1.5 align-top text-neutral-700">{inline(c)}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }
    const ordered = /^\d+\.\s/.test(line);
    if (ordered || line.startsWith("- ")) {
      const items: string[] = [];
      while (i < lines.length && (ordered ? /^\d+\.\s/.test(lines[i]) : lines[i].startsWith("- "))) {
        items.push(lines[i++].replace(ordered ? /^\d+\.\s/ : /^- /, ""));
      }
      const cls = `mt-2 space-y-1 pl-5 text-sm text-neutral-700 ${ordered ? "list-decimal" : "list-disc"}`;
      const lis = items.map((t, j) => <li key={j}>{inline(t)}</li>);
      out.push(ordered ? <ol key={key} className={cls}>{lis}</ol> : <ul key={key} className={cls}>{lis}</ul>);
      continue;
    }
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() && !/^(#{2,3} |\||- |\d+\.\s)/.test(lines[i])) para.push(lines[i++]);
    out.push(<p key={key} className="mt-2 text-sm leading-relaxed text-neutral-700">{inline(para.join(" "))}</p>);
  }
  return <div>{out}</div>;
}
