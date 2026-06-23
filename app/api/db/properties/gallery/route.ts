import { NextResponse } from "next/server";
import { setPropertyGallery, type GalleryItemSpec } from "@/lib/db";

// Persists an ordered gallery for a property. Accepts multipart form-data:
//   propertyId : string
//   spec       : JSON array describing order — { kind:"url", url } | { kind:"file", key }
//   <key>      : the image Blob for each { kind:"file" } item
// Uploaded files go to Supabase Storage; both uploads and URL items are written,
// in order, to the property's gallery_urls column.
type SpecItem = { kind: "url"; url: string } | { kind: "file"; key: string };

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const propertyId = form.get("propertyId");
    const specRaw = form.get("spec");

    if (typeof propertyId !== "string" || !propertyId) {
      return NextResponse.json({ error: "missing propertyId" }, { status: 400 });
    }
    if (typeof specRaw !== "string") {
      return NextResponse.json({ error: "missing spec" }, { status: 400 });
    }

    const spec = JSON.parse(specRaw) as SpecItem[];
    const items: GalleryItemSpec[] = [];

    for (const item of spec) {
      if (item.kind === "url") {
        if (item.url) items.push({ type: "external", url: item.url });
        continue;
      }
      const blob = form.get(item.key);
      if (!(blob instanceof Blob)) continue;
      if (blob.size > 20 * 1024 * 1024) {
        return NextResponse.json({ error: "an image exceeds 20MB" }, { status: 400 });
      }
      const filename = (blob as File).name || "photo.jpg";
      items.push({
        type: "upload",
        bytes: await blob.arrayBuffer(),
        filename,
        contentType: blob.type || "image/jpeg",
      });
    }

    const urls = await setPropertyGallery(propertyId, items);
    return NextResponse.json({ urls });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
