import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Server-only Supabase client using the service_role key. This bypasses RLS, so
// it must never be imported into client code. All rental tables have RLS enabled
// with no policies, meaning only this server layer can read/write them.

let client: SupabaseClient | null = null;

export function supabaseAdmin(): SupabaseClient {
  if (client) return client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) throw new Error("SUPABASE_URL is not set");
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}

/** Bucket holding property cover + gallery images (public read). */
export const IMAGE_BUCKET = "property-images";
