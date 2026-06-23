import { NextResponse } from "next/server";
import { uploadPropertyCover } from "@/lib/db";

// Accepts a multipart form ( propertyId + file ) and stores the image in the
// Supabase `property-images` bucket, persisting its public URL to the
// property's image_url column. Returns the stable public URL.
export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const propertyId = form.get("propertyId");
    const file = form.get("file");

    if (typeof propertyId !== "string" || !propertyId) {
      return NextResponse.json({ error: "missing propertyId" }, { status: 400 });
    }
    if (!(file instanceof Blob)) {
      return NextResponse.json({ error: "missing file" }, { status: 400 });
    }
    if (file.size > 20 * 1024 * 1024) {
      return NextResponse.json({ error: "image exceeds 20MB" }, { status: 400 });
    }

    const filename = (file as File).name || "cover.jpg";
    const contentType = file.type || "image/jpeg";
    const bytes = await file.arrayBuffer();

    const url = await uploadPropertyCover(propertyId, bytes, filename, contentType);
    return NextResponse.json({ url });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
