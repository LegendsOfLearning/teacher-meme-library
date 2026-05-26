#!/usr/bin/env node
// Re-render template gallery items g41–g80 from gallery.js captions.

import path from "node:path";
import { promises as fs } from "node:fs";
import { fileURLToPath } from "node:url";
import { galleryItems } from "../app/lib/gallery.js";
import { getFormatById } from "../app/lib/meme-formats.js";
import { renderMeme } from "../app/lib/render.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const outDir = path.join(root, "public", "gallery");

const BATCH_IDS = [
  "g41",
  "g42",
  "g43",
  "g44",
  "g45",
  "g46",
  "g47",
  "g48",
  "g49",
  "g50",
  "g51",
  "g52",
  "g53",
  "g54",
  "g55",
  "g56",
  "g57",
  "g58",
  "g59",
  "g60",
  "g61",
  "g62",
  "g63",
  "g64",
  "g65",
  "g66",
  "g67",
  "g68",
  "g69",
  "g70",
  "g71",
  "g72",
  "g73",
  "g74",
  "g75",
  "g76",
  "g77",
  "g78",
  "g79",
  "g80",
];

async function main() {
  await fs.mkdir(outDir, { recursive: true });
  let ok = 0;
  for (const id of BATCH_IDS) {
    const item = galleryItems.find((g) => g.id === id);
    if (!item?.remixFormatId || !item.captions) {
      console.error(`[skip] ${id}: missing item or captions`);
      continue;
    }
    const format = getFormatById(item.remixFormatId);
    if (!format) {
      console.error(`[skip] ${id}: unknown format ${item.remixFormatId}`);
      continue;
    }
    const fileName = item.file.replace(/^\/gallery\//, "");
    try {
      const buf = await renderMeme(format, item.captions);
      await fs.writeFile(path.join(outDir, fileName), buf);
      console.log(`[ok] ${id} -> ${fileName} (${buf.length} B)`);
      ok++;
    } catch (err) {
      console.error(`[fail] ${id}: ${err.message}`);
    }
  }
  console.log(`\nDone: ${ok}/${BATCH_IDS.length} rendered`);
  if (ok !== BATCH_IDS.length) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
