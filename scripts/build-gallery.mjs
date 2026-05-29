#!/usr/bin/env node
// Watermarks every curated gallery PNG with the Legends of Learning
// logo and writes the result to public/gallery/.
//
// Placement uses the same collision-aware resolver as live meme
// rendering — logo moves to bl/tr/tl and scales down before overlapping
// caption bands or baked punchlines.

import path from "node:path";
import { promises as fs } from "node:fs";
import sharp from "sharp";
import { galleryItems, gallerySourceMap } from "../app/lib/gallery.js";
import { getFormatById } from "../app/lib/meme-formats.js";
import {
  buildMemeLoopFooterSvg,
  padPngToSquare,
  resolveWatermarkPlacement,
} from "../app/lib/render.js";

const projectRoot = path.resolve(import.meta.dirname || ".", "..");
const sourceDir = path.resolve(
  projectRoot,
  "../../.cursor/projects/Users-morabreyaui-Code-teacher-meme-generator/assets"
);
const outDir = path.join(projectRoot, "public", "gallery");

/** Fallback when a gallery PNG has no remix format / captions. */
const GALLERY_FALLBACK_FORMAT = {
  bakedObstacles: [
    { x: 0, y: 0.72, w: 1, h: 0.28 },
    { x: 0, y: 0, w: 1, h: 0.2 },
  ],
  zones: [],
};

async function ensureDir(p) {
  await fs.mkdir(p, { recursive: true });
}

function galleryItemForOutput(outName) {
  return galleryItems.find((g) => g.file === `/gallery/${outName}`) || null;
}

async function processOne(srcName, outName) {
  const srcPath = path.join(sourceDir, srcName);
  const outPath = path.join(outDir, outName);
  const baseBuf = await fs.readFile(srcPath);
  const meta = await sharp(baseBuf).metadata();
  const size = { width: meta.width, height: meta.height };

  const item = galleryItemForOutput(outName);
  const format = item?.remixFormatId
    ? { ...getFormatById(item.remixFormatId), file: item.file }
    : GALLERY_FALLBACK_FORMAT;
  const captions = item?.captions || {};

  const placement = await resolveWatermarkPlacement(format, captions, size);

  const radius = Math.round(placement.pillH * 0.32);
  const pillSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${placement.pillW}" height="${placement.pillH}"><rect x="0" y="0" width="${placement.pillW}" height="${placement.pillH}" rx="${radius}" ry="${radius}" fill="black" fill-opacity="0.55"/></svg>`;
  const pillBuf = Buffer.from(pillSvg);

  const composed = await sharp(baseBuf)
    .composite([
      { input: pillBuf, top: placement.pillTop, left: placement.pillLeft, blend: "over" },
      {
        input: placement.logoBuf,
        top: placement.logoTopPx,
        left: placement.logoLeftPx,
        blend: "over",
      },
      {
        input: buildMemeLoopFooterSvg(size.width, size.height),
        top: 0,
        left: 0,
        blend: "over",
      },
    ])
    .png({ compressionLevel: 9, quality: 92 })
    .toBuffer();

  const square = await padPngToSquare(composed);
  await fs.writeFile(outPath, square);

  return {
    srcName,
    outName,
    bytes: square.length,
    corner: placement.corner,
    scale: placement.logoScale,
  };
}

async function main() {
  await ensureDir(outDir);

  const entries = Object.entries(gallerySourceMap);
  const results = [];
  for (const [srcName, outName] of entries) {
    try {
      const r = await processOne(srcName, outName);
      results.push({ ok: true, ...r });
      console.log(
        `[ok] ${srcName} -> public/gallery/${outName} (${r.bytes} B, ${r.corner} @${Math.round(r.scale * 100)}%)`
      );
    } catch (err) {
      results.push({ ok: false, srcName, outName, error: err.message });
      console.error(`[fail] ${srcName}: ${err.message}`);
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
