import { NextResponse } from "next/server";
import { getPublicListing, getPublicListings } from "@/lib/shareListing";

// Public listing API for the Share feature. Returns ONLY safe fields (see
// lib/shareListing.ts) — no revenue, expenses, tenant, or occupancy data.
//   GET /api/share/listing            -> all listings
//   GET /api/share/listing?slug=<id>  -> a single listing (404 if absent)
export async function GET(req: Request) {
  try {
    const slug = new URL(req.url).searchParams.get("slug");
    if (slug) {
      const listing = await getPublicListing(slug);
      if (!listing) {
        return NextResponse.json({ error: "not found" }, { status: 404 });
      }
      return NextResponse.json({ data: listing });
    }
    const data = await getPublicListings();
    return NextResponse.json({ data });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
