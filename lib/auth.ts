import { createClient } from "@/lib/supabase/client";

/** Auth helpers backed by Supabase Auth. The session lives in cookies and is
 *  enforced server-side by middleware.ts — these are just client conveniences. */

/** Signs the current user out and clears the session cookies. */
export async function signOut(): Promise<void> {
  const supabase = createClient();
  await supabase.auth.signOut();
}
