#!/usr/bin/env node
// Rebuilds gallery PNGs that have an explicit clean-template pipeline only.
//
// AI-curated gallery cards (most of /public/gallery/) are hand-reviewed
// assets — do NOT run this script to overwrite them from stock templates.
// Those cards keep their on-photo caption style; edits re-render via
// renderGalleryMeme({ forEdit: true }) in the workflow.

import path from "node:path";
import { promises as fs } from "node:fs";
import { galleryItems } from "../app/lib/gallery.js";
import { getFormatById } from "../app/lib/meme-formats.js";
import { GALLERY_RENDER_SOURCES } from "../app/lib/render.js";
import { renderGalleryMeme } from "../app/lib/gallery-meme.js";

const projectRoot = path.resolve(import.meta.dirname || ".", "..");
const outDir = path.join(projectRoot, "public", "gallery");

function canRebuildFromTemplate(item) {
  if (item.cleanBase) return true;
  if (GALLERY_RENDER_SOURCES[item.file]) return true;
  const fmt = getFormatById(item.remixFormatId);
  if (!fmt) return false;
  if (fmt.galleryTemplate) return true;
  const stock = fmt.renderFile || fmt.file;
  return typeof stock === "string" && stock.includes("/templates-meme/");
}

async function ensureDir(p) {
  await fs.mkdir(p, { recursive: true });
}

async function main() {
  await ensureDir(outDir);

  const results = [];
  for (const item of galleryItems) {
    const outName = item.file.replace(/^\/gallery\//, "");
    const outPath = path.join(outDir, outName);
    if (!item.remixFormatId || !item.captions) {
      console.log(`[skip] ${outName} (no remixFormatId/captions)`);
      continue;
    }
    if (!canRebuildFromTemplate(item)) {
      console.log(
        `[skip] ${outName} (AI gallery card — keep existing PNG; no clean template)`
      );
      continue;
    }
    try {
      const png = await renderGalleryMeme(item, item.captions);
      await fs.writeFile(outPath, png);
      results.push({ ok: true, outName, bytes: png.length });
      console.log(`[ok] public/gallery/${outName} (${png.length} B)`);
    } catch (err) {
      results.push({ ok: false, outName, error: err.message });
      console.error(`[fail] ${outName}: ${err.message}`);
    }
  }

  const ok = results.filter((r) => r.ok).length;
  const fail = results.length - ok;
  console.log(`\nGallery build done: ${ok} ok, ${fail} failed`);
  if (fail > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
