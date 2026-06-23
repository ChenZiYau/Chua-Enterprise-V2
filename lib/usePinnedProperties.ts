"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "ems:pinned-properties";
// Custom event so every card / list mounted in the same tab stays in sync.
const SYNC_EVENT = "ems:pinned-properties-changed";

function readPinned(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function writePinned(ids: string[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  window.dispatchEvent(new CustomEvent(SYNC_EVENT));
}

/**
 * Per-browser list of pinned property ids. Pinning is a view preference, so it
 * lives in localStorage rather than the database. Stays in sync across components in
 * the same tab (custom event) and across tabs (native `storage` event).
 */
export function usePinnedProperties() {
  // Start empty so the server and first client render agree; hydrate after mount.
  const [pinnedIds, setPinnedIds] = useState<string[]>([]);

  useEffect(() => {
    setPinnedIds(readPinned());
    const sync = () => setPinnedIds(readPinned());
    window.addEventListener(SYNC_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(SYNC_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const isPinned = useCallback(
    (id: string) => pinnedIds.includes(id),
    [pinnedIds]
  );

  const togglePin = useCallback((id: string) => {
    const current = readPinned();
    const next = current.includes(id)
      ? current.filter((x) => x !== id)
      : [id, ...current];
    writePinned(next);
    setPinnedIds(next);
  }, []);

  return { pinnedIds, isPinned, togglePin };
}
