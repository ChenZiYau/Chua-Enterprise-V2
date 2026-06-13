import { NextResponse } from "next/server";
import { uploadPageCover } from "@/lib/notion";

// Accepts a multipart form ( pageId + file ) and stores the image as the
// property page's cover via Notion's File Upload API. Returns a fresh,
// display-ready signed URL. Subsequent loads re-read the cover for a fresh URL.
export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const pageId = form.get("pageId");
    const file = form.get("file");

    if (typeof pageId !== "string" || !pageId) {
      return NextResponse.json({ error: "missing pageId" }, { status: 400 });
    }
    if (!(file instanceof Blob)) {
      return NextResponse.json({ error: "missing file" }, { status: 400 });
    }
    // Notion direct upload limit is 20MB.
    if (file.size > 20 * 1024 * 1024) {
      return NextResponse.json({ error: "image exceeds 20MB" }, { status: 400 });
    }

    const filename = (file as File).name || "cover.jpg";
    const contentType = file.type || "image/jpeg";
    const bytes = await file.arrayBuffer();

    const url = await uploadPageCover(pageId, bytes, filename, contentType);
    return NextResponse.json({ url });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
