#!/usr/bin/env node
// Replace the baked meme-loop footer on every public/gallery PNG with the
// current MEME_LOOP_FOOTER_TEXT (www.teacher-memes.com).
//
// Always clears a fixed bottom band first so stacked/duplicate footers
// cannot survive, then draws exactly one signature line.

import path from "node:path";
import { promises as fs } from "node:fs";
import sharp from "sharp";
import { galleryItems } from "../app/lib/gallery.js";
import {
  MEME_LOOP_FOOTER_TEXT,
  buildMemeLoopFooterSvg,
} from "../app/lib/render.js";

const projectRoot = path.resolve(import.meta.dirname || ".", "..");
const outDir = path.join(projectRoot, "public", "gallery");
const CLEAR_FRAC = 0.09; // only wipe the signature strip (not caption letterbox)

async function restripeFooter(pngBuf) {
  const meta = await sharp(pngBuf).metadata();
  const width = meta.width;
  const height = meta.height;
  const clearTop = Math.max(0, Math.round(height * (1 - CLEAR_FRAC)));

  const clearSvg = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <rect x="0" y="${clearTop}" width="${width}" height="${
      height - clearTop
    }" fill="#000000"/>
    </svg>`
  );
  const footerSvg = buildMemeLoopFooterSvg(width, height, MEME_LOOP_FOOTER_TEXT, {
    topEndFrac: 0,
    bottomStartFrac: clearTop / height,
  });

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
      console.log(`[ok] ${outName}`);
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
