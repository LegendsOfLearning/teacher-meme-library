#!/usr/bin/env node
// Replace the baked meme-loop footer on every public/gallery PNG with the
// current MEME_LOOP_FOOTER_TEXT (classroom-memes.legendsoflearning.com).
//
// Does NOT re-render captions or swap AI art for stock templates — only
// clears the bottom footer band and redraws the signature line.

import path from "node:path";
import { promises as fs } from "node:fs";
import sharp from "sharp";
import { galleryItems } from "../app/lib/gallery.js";
import {
  MEME_LOOP_FOOTER_TEXT,
  buildMemeLoopFooterSvg,
  footerBandMetrics,
} from "../app/lib/render.js";

const projectRoot = path.resolve(import.meta.dirname || ".", "..");
const outDir = path.join(projectRoot, "public", "gallery");

/** Find where near-white footer glyphs start near the bottom of the canvas. */
async function detectFooterTop(pngBuf, width, height) {
  const { data, info } = await sharp(pngBuf)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const channels = info.channels;
  // Only inspect the bottom strip — never reach into meme captions.
  const scanFrom = Math.floor(height * 0.88);
  let footerBottom = -1;
  let footerTop = -1;
  for (let y = height - 1; y >= scanFrom; y--) {
    let white = 0;
    for (let x = 0; x < width; x += 2) {
      const i = (y * width + x) * channels;
      if (data[i] > 200 && data[i + 1] > 200 && data[i + 2] > 200) white++;
    }
    const hasWhite = white > width * 0.015;
    if (hasWhite) {
      if (footerBottom < 0) footerBottom = y;
      footerTop = y;
    } else if (footerBottom >= 0) {
      break;
    }
  }
  // Always reserve enough room for the long classroom-memes URL.
  const minBand = Math.max(36, Math.round(height * 0.07));
  const fromGlyphs =
    footerTop >= 0
      ? Math.max(scanFrom, footerTop - Math.round(height * 0.01))
      : height - minBand;
  return Math.min(fromGlyphs, height - minBand);
}

async function restripeFooter(pngBuf) {
  const meta = await sharp(pngBuf).metadata();
  const width = meta.width;
  const height = meta.height;
  const footerTop = await detectFooterTop(pngBuf, width, height);
  const clearH = height - footerTop;
  if (clearH < 8) return pngBuf;

  // Force footer metrics into the cleared band.
  const letterboxBounds = {
    topEndFrac: 0,
    bottomStartFrac: footerTop / height,
  };
  const { bandTop } = footerBandMetrics(width, height, letterboxBounds);
  const clearTop = Math.min(footerTop, bandTop);

  const clearSvg = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <rect x="0" y="${clearTop}" width="${width}" height="${
      height - clearTop
    }" fill="#000000"/>
    </svg>`
  );
  const footerSvg = buildMemeLoopFooterSvg(
    width,
    height,
    MEME_LOOP_FOOTER_TEXT,
    { topEndFrac: 0, bottomStartFrac: clearTop / height }
  );

  return sharp(pngBuf)
    .composite([
      { input: clearSvg, top: 0, left: 0 },
      { input: footerSvg, top: 0, left: 0 },
    ])
    .png({ compressionLevel: 9, quality: 92 })
    .toBuffer();
}

async function main() {
  console.log(`Footer text: ${MEME_LOOP_FOOTER_TEXT}\n`);
  const seen = new Set();
  let ok = 0;
  let fail = 0;
  let skip = 0;

  for (const item of galleryItems) {
    if (!item.file?.startsWith("/gallery/")) {
      skip++;
      continue;
    }
    const outName = item.file.replace(/^\/gallery\//, "").split("?")[0];
    if (seen.has(outName)) continue;
    seen.add(outName);

    const outPath = path.join(outDir, outName);
    try {
      const existing = await fs.readFile(outPath);
      const next = await restripeFooter(existing);
      await fs.writeFile(outPath, next);
      ok++;
      console.log(`[ok] ${outName} (${next.length} B)`);
    } catch (err) {
      fail++;
      console.error(`[fail] ${outName}: ${err.message}`);
    }
  }

  console.log(`\nFooter restripe done: ${ok} ok, ${fail} failed, ${skip} skipped`);
  if (fail > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
