import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";

// Keep-alive ping for the Supabase free tier (paused after ~1 week idle).
// Hit on a schedule by a Vercel cron (see vercel.json). Runs a tiny query so
// Postgres registers activity. Unauthenticated by design — called server-side
// by Vercel cron, which carries no session.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // Lightweight "SELECT 1"-equivalent for the supabase-js client: a head-only
    // count against an existing table touches Postgres without returning rows.
    const { error } = await supabaseAdmin()
      .from("properties")
      .select("id", { count: "exact", head: true });

    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
