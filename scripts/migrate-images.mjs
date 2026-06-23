// One-shot migration of property cover images from Notion (uploaded page covers,
// served via short-lived signed URLs) into Supabase Storage, persisting the
// resulting public URLs to public.properties.image_url.
//
// Prerequisites:
//   - .env must contain SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
//   - run from the project root:  node scripts/migrate-images.mjs
//
// Safe to re-run: it only updates properties whose image_url is still empty.
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

// --- Notion source (read-only) ---
// Provide the Notion token + properties DB id via env (or .env), e.g.:
//   NOTION_API_KEY=ntn_xxx NOTION_DB_PROPERTIES=xxxx node scripts/migrate-images.mjs
const BUCKET = "property-images";

// --- read .env without extra deps ---
function loadEnv() {
  const out = {};
  try {
    for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m) out[m[1]] = m[2];
    }
  } catch {}
  return out;
}

const env = { ...loadEnv(), ...process.env };
const SUPABASE_URL = env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env");
  process.exit(1);
}

const NOTION_KEY = env.NOTION_API_KEY;
const NOTION_DB_PROPERTIES = env.NOTION_DB_PROPERTIES;
if (!NOTION_KEY || !NOTION_DB_PROPERTIES) {
  console.error("Missing NOTION_API_KEY or NOTION_DB_PROPERTIES (pass via env or .env)");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const H = {
  Authorization: `Bearer ${NOTION_KEY}`,
  "Notion-Version": "2022-06-28",
  "Content-Type": "application/json",
};

const titleOf = (p) =>
  (p.properties["Name"]?.title || []).map((t) => t.plain_text).join("");
const coverUrlOf = (p) => {
  const c = p.cover;
  if (!c) return "";
  if (c.type === "file") return c.file?.url || "";
  if (c.type === "external") return c.external?.url || "";
  return "";
};

async function notionProperties() {
  const out = [];
  let cursor;
  do {
    const body = { page_size: 100 };
    if (cursor) body.start_cursor = cursor;
    const r = await fetch(
      `https://api.notion.com/v1/databases/${NOTION_DB_PROPERTIES}/query`,
      { method: "POST", headers: H, body: JSON.stringify(body) }
    );
    if (!r.ok) throw new Error(`Notion query failed: ${r.status} ${await r.text()}`);
    const j = await r.json();
    out.push(...j.results);
    cursor = j.has_more ? j.next_cursor : undefined;
  } while (cursor);
  return out;
}

async function run() {
  const pages = await notionProperties();
  for (const page of pages) {
    const name = titleOf(page);
    const coverUrl = coverUrlOf(page);
    if (!coverUrl || page.cover?.type !== "file") continue; // only uploaded covers

    // Find the matching Supabase property that still needs an image.
    const { data: rows, error: selErr } = await supabase
      .from("properties")
      .select("id, image_url")
      .eq("name", name)
      .limit(1);
    if (selErr) throw selErr;
    const prop = rows?.[0];
    if (!prop) {
      console.warn(`! No Supabase property named "${name}" — skipped`);
      continue;
    }
    if (prop.image_url) {
      console.log(`= ${name}: already has image_url, skipped`);
      continue;
    }

    const img = await fetch(coverUrl);
    if (!img.ok) {
      console.warn(`! ${name}: cover download failed (${img.status})`);
      continue;
    }
    const contentType = img.headers.get("content-type") || "image/jpeg";
    const ext = (contentType.split("/")[1] || "jpg").split(";")[0];
    const bytes = new Uint8Array(await img.arrayBuffer());
    const path = `${prop.id}/cover-${Date.now()}.${ext}`;

    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(path, bytes, { contentType, upsert: true });
    if (upErr) throw upErr;

    const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
    const { error: updErr } = await supabase
      .from("properties")
      .update({ image_url: pub.publicUrl })
      .eq("id", prop.id);
    if (updErr) throw updErr;

    console.log(`+ ${name}: cover migrated -> ${pub.publicUrl}`);
  }
  console.log("Done.");
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
