import { NextResponse } from "next/server";
import { uploadFile, setPageGallery, type GalleryItemSpec } from "@/lib/notion";

// Persists an ordered gallery for a property page. Accepts multipart form-data:
//   pageId : string
//   spec   : JSON array describing order — { kind:"url", url } | { kind:"file", key }
//   <key>  : the image Blob for each { kind:"file" } item
// Uploaded files go through Notion's File Upload API; both uploads and URL items
// are written, in order, to the page's "Gallery" files property.
type SpecItem = { kind: "url"; url: string } | { kind: "file"; key: string };

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const pageId = form.get("pageId");
    const specRaw = form.get("spec");

    if (typeof pageId !== "string" || !pageId) {
      return NextResponse.json({ error: "missing pageId" }, { status: 400 });
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
      const id = await uploadFile(await blob.arrayBuffer(), filename, blob.type || "image/jpeg");
      items.push({ type: "file_upload", id });
    }

    const urls = await setPageGallery(pageId, items);
    return NextResponse.json({ urls });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
