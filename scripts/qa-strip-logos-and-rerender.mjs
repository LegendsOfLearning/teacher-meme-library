#!/usr/bin/env node
// Strip baked LoL corner logos from gallery PNGs that cannot rebuild
// from a clean templates-meme blank.

import path from "node:path";
import { promises as fs } from "node:fs";
import sharp from "sharp";
import { galleryItems } from "../app/lib/gallery.js";
import { getFormatById } from "../app/lib/meme-formats.js";
import {
  GALLERY_RENDER_SOURCES,
  detectLetterboxBandBounds,
  smudgeLegacyBrandCorners,
  renderMeme,
} from "../app/lib/render.js";

const projectRoot = path.resolve(import.meta.dirname || ".", "..");
const galleryDir = path.join(projectRoot, "public", "gallery");

function canRebuildFromTemplate(item) {
  if (item.cleanBase) return true;
  if (GALLERY_RENDER_SOURCES[item.file]) return true;
  const fmt = getFormatById(item.remixFormatId);
  if (!fmt) return false;
  if (fmt.galleryTemplate) return true;
  const stock = fmt.renderFile || fmt.file;
  return typeof stock === "string" && stock.includes("/templates-meme/");
}

async function main() {
  let n = 0;
  for (const item of galleryItems) {
    if (canRebuildFromTemplate(item)) continue;
    const outName = item.file.replace(/^\/gallery\//, "");
    const outPath = path.join(galleryDir, outName);
    try {
      let buf = await fs.readFile(outPath);
      const meta = await sharp(buf).metadata();
      const size = { width: meta.width, height: meta.height };
      const bounds = await detectLetterboxBandBounds(buf);
      buf = await smudgeLegacyBrandCorners(buf, size, bounds);
      await fs.writeFile(outPath, buf);
      n += 1;
      console.log(`[ok] smudged ${outName}`);
    } catch (err) {
      console.error(`[fail] ${outName}: ${err.message}`);
    }
  }

  // Re-render templates whose captions/logo were fixed in formats.
  const rerenderIds = new Set([
    "hide-the-pain-harold",
    "distracted-boyfriend",
  ]);
  for (const item of galleryItems) {
    if (!rerenderIds.has(item.remixFormatId) || !item.captions) continue;
    const format = getFormatById(item.remixFormatId);
    if (!format) continue;
    try {
      const buf = await renderMeme(format, item.captions, {
        cleanBase: item.cleanBase || format.renderFile || format.file,
      });
      const outPath = path.join(
        galleryDir,
        item.file.replace(/^\/gallery\//, "")
      );
      await fs.writeFile(outPath, buf);
      console.log(`[ok] rerender ${item.id}`);
    } catch (err) {
      console.error(`[fail] rerender ${item.id}: ${err.message}`);
    }
  }

  console.log(`\nSmudged ${n} AI logo cards + re-rendered harold/distracted`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
