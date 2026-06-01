#!/usr/bin/env node
// Watermarks every curated gallery PNG with the Legends of Learning
// logo + subtle footer signature and writes to public/gallery/.

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
    ])
    .png({ compressionLevel: 9, quality: 92 })
    .toBuffer();

  // Pad to square so letterbox bars exist, then add footer signature.
  const square = await padPngToSquare(composed);
  const sqMeta = await sharp(square).metadata();
  const final = await sharp(square)
    .composite([
      {
        input: buildMemeLoopFooterSvg(sqMeta.width, sqMeta.height),
        top: 0,
        left: 0,
        blend: "over",
      },
    ])
    .png({ compressionLevel: 9, quality: 92 })
    .toBuffer();

  await fs.writeFile(outPath, final);

  return {
    srcName,
    outName,
    bytes: final.length,
    corner: placement.corner,
    scale: placement.logoScale,
  };
}

/** Refresh footer on an existing gallery PNG without re-rendering captions. */
async function overlayFooterOnly(outName) {
  const outPath = path.join(outDir, outName);
  let baseBuf = await fs.readFile(outPath);
  const meta = await sharp(baseBuf).metadata();

  // Clear old footer area (covers previous purple banner) before placing new one.
  const clearH = Math.max(60, Math.round(meta.width * 0.055));
  const clearTop = meta.height - clearH;
  const clearSvg = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${meta.width}" height="${meta.height}"><rect x="0" y="${clearTop}" width="${meta.width}" height="${clearH}" fill="#000000"/></svg>`
  );
  baseBuf = await sharp(baseBuf)
    .composite([{ input: clearSvg, top: 0, left: 0 }])
    .toBuffer();

  const composed = await sharp(baseBuf)
    .composite([
      {
        input: buildMemeLoopFooterSvg(meta.width, meta.height),
        top: 0,
        left: 0,
        blend: "over",
      },
    ])
    .png({ compressionLevel: 9, quality: 92 })
    .toBuffer();
  await fs.writeFile(outPath, composed);
  return { outName, bytes: composed.length };
}

async function main() {
  await ensureDir(outDir);

  const results = [];
  const sourceOutNames = new Set(Object.values(gallerySourceMap));

  for (const [srcName, outName] of Object.entries(gallerySourceMap)) {
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

  for (const item of galleryItems) {
    const outName = item.file.replace(/^\/gallery\//, "");
    if (sourceOutNames.has(outName)) continue;
    try {
      const r = await overlayFooterOnly(outName);
      results.push({ ok: true, ...r, footerOnly: true });
      console.log(`[footer] public/gallery/${outName} (${r.bytes} B)`);
    } catch (err) {
      results.push({ ok: false, outName, error: err.message });
      console.error(`[fail] footer ${outName}: ${err.message}`);
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
