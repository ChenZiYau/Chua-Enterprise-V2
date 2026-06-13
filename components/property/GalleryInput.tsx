"use client";

import { useEffect, useRef, useState } from "react";
import { CoverImageInput } from "@/components/property/CoverImageInput";

/**
 * Multi-image gallery manager. Reuses the cover control (in "adder" mode) so each
 * image is added by upload-or-URL + crop, then shown in an ordered thumbnail grid
 * that supports remove and reorder. Reports:
 *   - onItemsChange: the full ordered list (URL items + image Blobs) for storage.
 *   - onUrlsChange:  the URL-only items joined by newline (kept in `gallery_urls`
 *                    for back-compat and the URL-only edit path).
 */

export type GalleryOutItem = { previewUrl: string; url?: string; file?: File };

type Item = {
  key: string;
  kind: "url" | "file";
  /** Display source: the URL itself, or an object URL for an uploaded file. */
  previewUrl: string;
  url?: string;
  file?: File;
};

let counter = 0;
const nextKey = () => `g${Date.now().toString(36)}_${counter++}`;

function splitUrls(value?: string | null): string[] {
  if (!value) return [];
  return value
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function GalleryInput({
  value,
  onItemsChange,
  onUrlsChange,
  allowUpload = true,
}: {
  value?: string | null;
  onItemsChange?: (items: GalleryOutItem[]) => void;
  onUrlsChange?: (joined: string) => void;
  allowUpload?: boolean;
}) {
  const [items, setItems] = useState<Item[]>(() =>
    splitUrls(value).map((url) => ({ key: nextKey(), kind: "url", previewUrl: url, url }))
  );

  // Object URLs we created for uploaded files, revoked on unmount.
  const objectUrls = useRef<string[]>([]);
  useEffect(
    () => () => {
      objectUrls.current.forEach((u) => URL.revokeObjectURL(u));
    },
    []
  );

  // Skip the initial emit so simply opening a form (e.g. the edit drawer) doesn't
  // normalize/echo existing URLs back and look like an unsaved change.
  const didMount = useRef(false);

  // Report changes upward whenever the list changes (after first render).
  useEffect(() => {
    if (!didMount.current) {
      didMount.current = true;
      return;
    }
    onItemsChange?.(
      items.map((it) =>
        it.kind === "url"
          ? { previewUrl: it.previewUrl, url: it.url! }
          : { previewUrl: it.previewUrl, file: it.file! }
      )
    );
    onUrlsChange?.(
      items
        .filter((it) => it.kind === "url")
        .map((it) => it.url!)
        .join("\n")
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  function add(result: { url: string } | { file: File; previewUrl: string }) {
    setItems((prev) => {
      if ("url" in result) {
        return [...prev, { key: nextKey(), kind: "url", previewUrl: result.url, url: result.url }];
      }
      objectUrls.current.push(result.previewUrl);
      return [...prev, { key: nextKey(), kind: "file", previewUrl: result.previewUrl, file: result.file }];
    });
  }

  function remove(key: string) {
    setItems((prev) => prev.filter((it) => it.key !== key));
  }

  function move(key: string, dir: -1 | 1) {
    setItems((prev) => {
      const i = prev.findIndex((it) => it.key === key);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= prev.length) return prev;
      const next = prev.slice();
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {items.length > 0 && (
        <ul className="grid grid-cols-3 @md:grid-cols-4 gap-2.5">
          {items.map((it, i) => (
            <li
              key={it.key}
              className="relative overflow-hidden rounded-lg border group"
              style={{ borderColor: "var(--border-soft)", background: "var(--surface-subtle)", aspectRatio: "1 / 1" }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={it.previewUrl} alt={`Gallery photo ${i + 1}`} className="w-full h-full object-cover" />

              {/* Remove */}
              <button
                type="button"
                onClick={() => remove(it.key)}
                aria-label={`Remove photo ${i + 1}`}
                title="Remove"
                className="absolute top-1 right-1 w-6 h-6 rounded-md flex items-center justify-center"
                style={{ background: "rgba(15,17,22,0.6)", color: "#fff", border: "1px solid rgba(255,255,255,0.2)" }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
              </button>

              {/* Reorder */}
              <div className="absolute bottom-1 inset-x-1 flex items-center justify-between">
                <ArrowBtn dir="left" disabled={i === 0} onClick={() => move(it.key, -1)} />
                <span
                  className="text-[10px] px-1.5 rounded tabular-nums"
                  style={{ background: "rgba(15,17,22,0.6)", color: "#fff" }}
                >
                  {i + 1}
                </span>
                <ArrowBtn dir="right" disabled={i === items.length - 1} onClick={() => move(it.key, 1)} />
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Adder: the same upload-or-URL + crop control as the cover. */}
      <CoverImageInput allowUpload={allowUpload} onCommit={add} />
    </div>
  );
}

function ArrowBtn({ dir, disabled, onClick }: { dir: "left" | "right"; disabled: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={dir === "left" ? "Move earlier" : "Move later"}
      className="w-6 h-6 rounded-md flex items-center justify-center transition"
      style={{
        background: "rgba(15,17,22,0.6)",
        color: "#fff",
        border: "1px solid rgba(255,255,255,0.2)",
        opacity: disabled ? 0.35 : 1,
      }}
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        {dir === "left" ? <path d="m15 18-6-6 6-6" /> : <path d="m9 18 6-6-6-6" />}
      </svg>
    </button>
  );
}
