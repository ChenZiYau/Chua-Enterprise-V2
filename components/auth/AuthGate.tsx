"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { isAuthed } from "@/lib/auth";

/** Client-side gate: if no auth flag, bounce to /login. While checking,
 *  render nothing to avoid a flash of admin UI. */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (isAuthed()) {
      setReady(true);
    } else {
      router.replace("/login");
    }
  }, [router]);

  if (!ready) return null;
  return <>{children}</>;
}
