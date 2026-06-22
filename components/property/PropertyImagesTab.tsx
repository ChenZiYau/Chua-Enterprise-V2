"use client";

import type { Property } from "@/types/rental";

/** Images tab — placeholder. Property/room gallery management is not implemented
 *  yet; this reserves the layout so the tab is navigable. */
export function PropertyImagesTab({ property }: { property: Property }) {
  void property;
  return (
    <div className="ui-card p-12 flex flex-col items-center text-center gap-3">
      <div
        className="w-12 h-12 rounded-xl flex items-center justify-center"
        style={{ background: "var(--surface-muted)", color: "var(--text-faint)" }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <circle cx="9" cy="9" r="2" />
          <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
        </svg>
      </div>
      <div>
        <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          Images coming soon
        </p>
        <p className="text-sm mt-1 max-w-md" style={{ color: "var(--text-muted)" }}>
          Property and room photo management will live here. This section hasn&apos;t been implemented yet.
        </p>
      </div>
    </div>
  );
}
