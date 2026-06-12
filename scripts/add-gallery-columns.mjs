// One-off migration: add a "Gallery URLs" rich-text property to the Notion
// Properties and Units databases, so the Share feature's photo galleries have a
// real, editable home in Notion (instead of being stubbed in code).
//
// Safe to re-run — Notion's database update is idempotent for an existing
// property of the same name/type. Reads credentials from .env.
//
//   node scripts/add-gallery-columns.mjs

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnv() {
  const raw = readFileSync(join(__dirname, "..", ".env"), "utf8");
  const env = {};
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2];
  }
  return env;
}

const env = loadEnv();
const KEY = env.NOTION_API_KEY;
if (!KEY) throw new Error("NOTION_API_KEY not found in .env");

const TARGETS = [
  ["Properties", env.NOTION_DB_PROPERTIES],
  ["Units", env.NOTION_DB_UNITS],
];

async function addGalleryColumn(label, databaseId) {
  if (!databaseId) {
    console.warn(`! ${label}: no database id in .env — skipped`);
    return;
  }
  const res = await fetch(`https://api.notion.com/v1/databases/${databaseId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${KEY}`,
      "Notion-Version": "2022-06-28",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      properties: { "Gallery URLs": { rich_text: {} } },
    }),
  });
  if (!res.ok) {
    console.error(`✗ ${label}: ${res.status} ${await res.text()}`);
    return;
  }
  console.log(`✓ ${label}: "Gallery URLs" property ensured`);
}

for (const [label, id] of TARGETS) {
  // eslint-disable-next-line no-await-in-loop
  await addGalleryColumn(label, id);
}
