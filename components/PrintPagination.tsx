"use client";

import { useEffect, useRef } from "react";

// Real "Page X of Y" footers for the printable reports.
//
// Browsers can't do this in CSS — Chrome supports neither @page margin boxes
// nor counter(pages) — so the page count has to be computed from the laid-out
// content. This measures the report, inserts a spacer wherever a block would
// straddle a page edge (which pins the browser's page breaks to the same
// places we computed), then drops an absolutely positioned footer at the foot
// of every page.
//
// Measuring happens with print-only styles applied (screen-only chrome such as
// the Print/Close buttons is hidden first), so the measurements match what the
// printer will actually lay out rather than what the screen shows.

const DPI = 96; // CSS pixels per inch
const A4_IN = {
  portrait: { h: 11.69, w: 8.27 },
  landscape: { h: 8.27, w: 11.69 },
};
const FOOTER_H = 18;

type Orientation = "portrait" | "landscape";

// The spacers and footers exist purely for the printed output; on screen the
// report keeps its normal, unpaginated appearance.
// The spacers/footers are print-only. Table footers are also pinned to flow
// normally: by default a <tfoot> is reprinted at the foot of every page, which
// would both repeat the TOTAL row and add height the page maths can't see.
const PRINT_ONLY_CSS = `
@media screen { .pp-spacer, .pp-footer { display: none !important; } }
@media print { tfoot { display: table-row-group !important; } }
`;

function paginate(
  root: HTMLElement,
  anchor: HTMLElement,
  orientation: Orientation,
  marginIn: number,
  caps: { company?: string; title?: string },
) {
  // Clear anything a previous run left behind so re-runs are idempotent.
  root.querySelectorAll(".pp-footer, .pp-spacer").forEach((n) => n.remove());
  root.style.minHeight = "";

  const page = A4_IN[orientation];
  const pageH = Math.floor((page.h - marginIn * 2) * DPI);
  const pageW = Math.floor((page.w - marginIn * 2) * DPI);
  const usableH = pageH - FOOTER_H;
  if (usableH <= 0) return;

  // Hide screen-only chrome so the flow we measure is the printed flow.
  const hidden: { el: HTMLElement; prev: string }[] = [];
  root.querySelectorAll<HTMLElement>(".print\\:hidden, [data-print-hidden]").forEach((el) => {
    hidden.push({ el, prev: el.style.display });
    el.style.display = "none";
  });
  anchor.style.display = "none";

  // Measure at the printed geometry, not the screen's: these pages are padded
  // and wider on screen (p-8 / max-w-3xl) but print edge-to-edge inside the
  // @page margin, and a different width re-wraps text and changes row heights.
  const geo = { width: root.style.width, maxWidth: root.style.maxWidth, padding: root.style.padding };
  root.style.width = `${pageW}px`;
  root.style.maxWidth = "none";
  root.style.padding = "0";

  try {
    const rootTop = root.getBoundingClientRect().top + window.scrollY;

    // Leaf blocks in document order. Anything that fits on a page is atomic;
    // anything taller gets broken down (tables into rows, so a long table can
    // span pages — the browser repeats <thead> for us).
    const blocks: HTMLElement[] = [];
    const collect = (el: HTMLElement) => {
      for (const child of Array.from(el.children) as HTMLElement[]) {
        if (child === anchor || child.tagName === "STYLE" || child.tagName === "SCRIPT") continue;
        if (child.classList.contains("pp-footer") || child.classList.contains("pp-spacer")) continue;
        const h = child.getBoundingClientRect().height;
        if (h === 0) continue;
        if (h <= usableH) {
          blocks.push(child);
        } else if (child.tagName === "TABLE") {
          const t = child as HTMLTableElement;
          for (const body of Array.from(t.tBodies)) blocks.push(...(Array.from(body.rows) as HTMLElement[]));
          if (t.tFoot) blocks.push(...(Array.from(t.tFoot.rows) as HTMLElement[]));
        } else if (child.children.length > 0) {
          collect(child);
        } else {
          blocks.push(child); // indivisible and oversized — let it overflow
        }
      }
    };
    collect(root);

    // When a table spans pages the browser reprints its <thead> at the top of
    // each continuation page. That height is printed but isn't in the DOM flow,
    // so everything after it shifts down; `carry` tracks the running difference
    // between DOM coordinates and printed coordinates.
    let carry = 0;
    const footerTops: number[] = [];

    let page = 0;
    for (const block of blocks) {
      const rect = block.getBoundingClientRect();
      const top = rect.top + window.scrollY - rootTop;
      const bottom = top + rect.height;
      const pageEnd = page * pageH + usableH - carry;
      if (bottom > pageEnd) {
        const gap = Math.max(0, pageEnd - top);
        const fill = gap + FOOTER_H; // pushes this block to the top of the next page
        if (block.tagName === "TR") {
          const cols = (block as HTMLTableRowElement).cells.length || 1;
          const sp = document.createElement("tr");
          sp.className = "pp-spacer";
          const td = document.createElement("td");
          td.colSpan = cols;
          td.style.cssText = `height:${fill}px;padding:0;border:none`;
          sp.appendChild(td);
          block.parentNode?.insertBefore(sp, block);
        } else {
          const sp = document.createElement("div");
          sp.className = "pp-spacer";
          sp.style.height = `${fill}px`;
          block.parentNode?.insertBefore(sp, block);
        }
        footerTops.push(pageEnd);
        page++;
        // Breaking inside a table means its header repeats on the next page.
        if (block.tagName === "TR") {
          const head = block.closest("table")?.tHead;
          if (head) carry += head.getBoundingClientRect().height;
        }
      }
    }

    const totalPages = page + 1;
    footerTops.push(page * pageH + usableH - carry);

    // Pad the flow out to the foot of the last page so the final footer sits
    // inside the printed area instead of overflowing past the end.
    const needed = footerTops[totalPages - 1] + FOOTER_H;
    const contentH = root.getBoundingClientRect().height;
    if (contentH < needed) {
      const tail = document.createElement("div");
      tail.className = "pp-spacer";
      tail.style.height = `${needed - contentH}px`;
      root.appendChild(tail);
    }

    // Caption for the left of every footer: company name + report name, taken
    // from the report header so the two always agree.
    const hdr = root.querySelector<HTMLElement>("[data-report-company], [data-report-title]");
    const caption = [caps.company ?? hdr?.dataset.reportCompany, caps.title ?? hdr?.dataset.reportTitle]
      .map((s) => (s ?? "").trim())
      .filter(Boolean)
      .join(" — ");

    if (getComputedStyle(root).position === "static") root.style.position = "relative";
    for (let i = 0; i < totalPages; i++) {
      const f = document.createElement("div");
      f.className = "pp-footer";
      f.style.cssText = `position:absolute;left:0;right:0;height:${FOOTER_H}px;line-height:${FOOTER_H}px;top:${footerTops[i]}px;display:flex;align-items:center;justify-content:space-between;gap:12px;font-size:10px;color:#666`;

      const left = document.createElement("span");
      left.style.cssText = "overflow:hidden;text-overflow:ellipsis;white-space:nowrap";
      left.textContent = caption; // textContent, so a company name can't inject markup
      const right = document.createElement("span");
      right.style.whiteSpace = "nowrap";
      right.textContent = `Page ${i + 1} of ${totalPages}`;

      f.append(left, right);
      root.appendChild(f);
    }
  } finally {
    root.style.width = geo.width;
    root.style.maxWidth = geo.maxWidth;
    root.style.padding = geo.padding;
    for (const { el, prev } of hidden) el.style.display = prev;
    anchor.style.display = "";
  }
}

/**
 * Drop-in footer for the print pages. Renders nothing itself — it measures the
 * report it sits in and stamps "Page X of Y" on each printed page.
 */
export function ReportFooter({
  orientation = "portrait",
  marginIn = 0.4,
  companyName,
  reportTitle,
}: {
  orientation?: Orientation;
  marginIn?: number;
  /** Defaults to the company name shown in <ReportHeader>. */
  companyName?: string;
  /** Defaults to the report title shown in <ReportHeader>. */
  reportTitle?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const anchor = ref.current;
    const root = anchor?.parentElement;
    if (!anchor || !root) return;

    let cancelled = false;
    const run = () => {
      if (!cancelled) paginate(root, anchor, orientation, marginIn, { company: companyName, title: reportTitle });
    };

    // Fonts change line heights, so wait for them before measuring.
    const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
    if (fonts?.ready) fonts.ready.then(run).catch(run);
    else run();

    // Re-measure right before printing, in case the window was resized or the
    // user prints after images finished loading.
    window.addEventListener("beforeprint", run);
    return () => {
      cancelled = true;
      window.removeEventListener("beforeprint", run);
    };
  }, [orientation, marginIn, companyName, reportTitle]);

  return (
    <div ref={ref} aria-hidden className="pp-anchor">
      <style>{PRINT_ONLY_CSS}</style>
    </div>
  );
}
