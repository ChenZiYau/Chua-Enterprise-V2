"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { usePathname } from "next/navigation";

type Ctx = {
  open: boolean;
  setOpen: (v: boolean) => void;
  toggle: () => void;
};

const MobileNavCtx = createContext<Ctx | null>(null);

export function MobileNavProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const toggle = useCallback(() => setOpen((v) => !v), []);

  // Close drawer on route change
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Lock body scroll while drawer is open
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <MobileNavCtx.Provider value={{ open, setOpen, toggle }}>
      {children}
    </MobileNavCtx.Provider>
  );
}

export function useMobileNav() {
  const ctx = useContext(MobileNavCtx);
  if (!ctx) {
    return { open: false, setOpen: () => {}, toggle: () => {} } as Ctx;
  }
  return ctx;
}
