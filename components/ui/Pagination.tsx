"use client";

import { useEffect, useMemo, useState } from "react";

/** Client-side pagination state for an already-filtered list. Resets to page 1
 *  when `resetKey` changes (e.g. filters), and clamps the page into range when
 *  the result count shrinks. */
export function usePagination<T>(items: T[], pageSize = 10, resetKey?: unknown) {
  const [page, setPage] = useState(1);
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  // Jump back to the first page whenever the filter signature changes.
  useEffect(() => {
    setPage(1);
  }, [resetKey]);

  // Keep the current page valid as the underlying list grows/shrinks.
  useEffect(() => {
    setPage((p) => Math.min(Math.max(1, p), totalPages));
  }, [totalPages]);

  const start = (page - 1) * pageSize;
  const pageItems = useMemo(() => items.slice(start, start + pageSize), [items, start, pageSize]);

  return { page, setPage, totalPages, total, pageSize, start, pageItems };
}

/** A sliding window of at most 5 consecutive page numbers centered on the
 *  current page (2 either side), clamped to range — no ellipses. E.g. page 1 →
 *  [1,2,3,4,5]; page 5 → [3,4,5,6,7]; last page → [n-4 … n]. */
function pageTokens(page: number, totalPages: number): number[] {
  const WINDOW = 5;
  if (totalPages <= WINDOW) return Array.from({ length: totalPages }, (_, i) => i + 1);
  let start = page - 2;
  let end = page + 2;
  if (start < 1) {
    end += 1 - start;
    start = 1;
  }
  if (end > totalPages) {
    start -= end - totalPages;
    end = totalPages;
  }
  start = Math.max(1, start);
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}

export function Pagination({
  page,
  totalPages,
  total,
  pageSize,
  onPage,
  unit = "item",
  unitPlural,
  className,
}: {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  onPage: (p: number) => void;
  unit?: string;
  unitPlural?: string;
  className?: string;
}) {
  if (total === 0) return null;

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  const tokens = pageTokens(page, totalPages);
  const noun = total === 1 ? unit : unitPlural ?? `${unit}s`;

  return (
    <div className={"flex flex-wrap items-center justify-between gap-3 " + (className ?? "")}>
      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
        Showing <span className="tabular-nums font-medium">{from}</span>–
        <span className="tabular-nums font-medium">{to}</span> of{" "}
        <span className="tabular-nums font-medium">{total}</span> {noun}
      </p>

      {totalPages > 1 && (
        <nav className="flex items-center gap-1.5" aria-label="Pagination">
          <PageBtn disabled={page <= 1} onClick={() => onPage(page - 1)} label="Previous">
            &#171;
          </PageBtn>

          {tokens.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => onPage(t)}
              disabled={t === page}
              aria-current={t === page ? "page" : undefined}
              className="min-w-9 h-9 px-2.5 inline-flex items-center justify-center text-sm font-semibold rounded-md border transition tabular-nums enabled:hover:bg-[var(--accent-soft)] disabled:cursor-default"
              style={{
                background: "transparent",
                // Current page reads as a faded/inactive token; the rest are
                // accent-outlined and clickable.
                color: t === page ? "var(--text-faint)" : "var(--accent)",
                borderColor: t === page ? "var(--border-soft)" : "var(--accent)",
              }}
            >
              {t}
            </button>
          ))}

          <PageBtn disabled={page >= totalPages} onClick={() => onPage(page + 1)} label="Next">
            &#187;
          </PageBtn>
        </nav>
      )}
    </div>
  );
}

/** Prev/next control — accent-outlined to match the numbered tokens. */
function PageBtn({
  disabled,
  onClick,
  label,
  children,
}: {
  disabled: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="w-9 h-9 inline-flex items-center justify-center text-base font-semibold leading-none rounded-md border transition enabled:hover:bg-[var(--accent-soft)] disabled:opacity-40 disabled:cursor-not-allowed"
      style={{ background: "transparent", color: "var(--accent)", borderColor: "var(--accent)" }}
    >
      {children}
    </button>
  );
}
