#!/usr/bin/env node
// Builds every curated gallery PNG:
//
// 1. gallerySourceMap entries → AI-generated assets get logo + footer.
// 2. Remixable items (with remixFormatId + captions) → rendered fresh
//    from the clean template using the current rendering engine.

import path from "node:path";
import { promises as fs } from "node:fs";
import sharp from "sharp";
import { galleryItems, gallerySourceMap } from "../app/lib/gallery.js";
import { getFormatById } from "../app/lib/meme-formats.js";
import {
  buildMemeLoopFooterSvg,
  padPngToSquare,
  renderMeme,
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

/** Process an AI-generated source asset: add logo watermark + footer. */
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

/** Render a gallery item from its clean template with proper text. */
async function renderFromTemplate(item) {
  const outName = item.file.replace(/^\/gallery\//, "");
  const outPath = path.join(outDir, outName);
  const format = getFormatById(item.remixFormatId);
  if (!format) throw new Error(`No format: ${item.remixFormatId}`);

  const png = await renderMeme(format, item.captions, {});

  await fs.writeFile(outPath, png);
  return { outName, bytes: png.length };
}

async function main() {
  await ensureDir(outDir);

  const results = [];
  const sourceOutNames = new Set(Object.values(gallerySourceMap));

  // Pass 1: AI-generated source assets (logo + footer only).
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

  // Pass 2: Remixable items rendered from clean templates.
  for (const item of galleryItems) {
    const outName = item.file.replace(/^\/gallery\//, "");
    if (sourceOutNames.has(outName)) continue;
    if (!item.remixFormatId || !item.captions) {
      console.log(`[skip] ${outName} (no remixFormatId/captions)`);
      continue;
    }
    try {
      const r = await renderFromTemplate(item);
      results.push({ ok: true, ...r, rendered: true });
      console.log(`[render] public/gallery/${outName} (${r.bytes} B)`);
    } catch (err) {
      results.push({ ok: false, outName, error: err.message });
      console.error(`[fail] render ${outName}: ${err.message}`);
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
