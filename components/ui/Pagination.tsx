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

/** Compact list of page tokens with ellipses, e.g. [1, "…", 4, 5, 6, "…", 12]. */
function pageTokens(page: number, totalPages: number): (number | "…")[] {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
  const tokens: (number | "…")[] = [1];
  const left = Math.max(2, page - 1);
  const right = Math.min(totalPages - 1, page + 1);
  if (left > 2) tokens.push("…");
  for (let i = left; i <= right; i++) tokens.push(i);
  if (right < totalPages - 1) tokens.push("…");
  tokens.push(totalPages);
  return tokens;
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
        <nav className="flex items-center gap-1" aria-label="Pagination">
          <PageBtn disabled={page <= 1} onClick={() => onPage(page - 1)} label="Previous">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </PageBtn>

          {tokens.map((t, i) =>
            t === "…" ? (
              <span key={`gap-${i}`} className="px-1.5 text-xs" style={{ color: "var(--text-faint)" }}>
                …
              </span>
            ) : (
              <button
                key={t}
                type="button"
                onClick={() => onPage(t)}
                aria-current={t === page ? "page" : undefined}
                className="min-w-8 h-8 px-2 text-xs font-medium rounded-lg transition tabular-nums"
                style={{
                  background: t === page ? "var(--accent)" : "var(--surface)",
                  color: t === page ? "#fff" : "var(--text-secondary)",
                  border: "1px solid " + (t === page ? "var(--accent)" : "var(--border-soft)"),
                }}
              >
                {t}
              </button>
            )
          )}

          <PageBtn disabled={page >= totalPages} onClick={() => onPage(page + 1)} label="Next">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </PageBtn>
        </nav>
      )}
    </div>
  );
}

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
      className="w-8 h-8 inline-flex items-center justify-center rounded-lg transition disabled:opacity-40 disabled:cursor-not-allowed"
      style={{ background: "var(--surface)", color: "var(--text-secondary)", border: "1px solid var(--border-soft)" }}
    >
      {children}
    </button>
  );
}
