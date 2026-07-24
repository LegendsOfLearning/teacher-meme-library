#!/usr/bin/env node
// Cover baked LoL circular watermarks on AI-only gallery PNGs.
// Targets the top-right of the *content* (inside letterbox), not the canvas.

import path from "node:path";
import { promises as fs } from "node:fs";
import sharp from "sharp";
import { galleryItems } from "../app/lib/gallery.js";
import { getFormatById } from "../app/lib/meme-formats.js";
import {
  GALLERY_RENDER_SOURCES,
  detectLetterboxBandBounds,
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

async function coverTopRightLogo(filePath) {
  const meta = await sharp(filePath).metadata();
  const W = meta.width;
  const H = meta.height;
  const bounds = await detectLetterboxBandBounds(
    await fs.readFile(filePath)
  );
  const contentTop = Math.round((bounds.topEndFrac || 0) * H);
  const contentBottom = Math.round((bounds.bottomStartFrac || 1) * H);
  const contentH = Math.max(40, contentBottom - contentTop);

  // Logo usually lives in the extreme top-right of the artwork panel.
  const coverW = Math.round(W * 0.085);
  const coverH = Math.round(contentH * 0.11);
  const left = W - coverW - Math.round(W * 0.012);
  const top = contentTop + Math.round(contentH * 0.012);

  // Sample fill from just left of the logo, inside the content.
  const sampleLeft = Math.max(0, left - Math.round(coverW * 0.8));
  const sample = await sharp(filePath)
    .extract({
      left: sampleLeft,
      top: top + Math.round(coverH * 0.2),
      width: Math.max(8, Math.round(coverW * 0.35)),
      height: Math.max(8, Math.round(coverH * 0.4)),
    })
    .resize(1, 1, { kernel: "nearest" })
    .raw()
    .toBuffer();
  const [sr, sg, sb] = sample;
  // If we sampled a dark patch (hair/shirt) on a light meme, prefer white.
  const sampleLum = (sr + sg + sb) / 3;
  let r = sr;
  let g = sg;
  let b = sb;
  if (sampleLum < 40) {
    const contentSample = await sharp(filePath)
      .extract({
        left: Math.round(W * 0.45),
        top: contentTop + Math.round(contentH * 0.08),
        width: Math.round(W * 0.1),
        height: Math.round(contentH * 0.08),
      })
      .resize(1, 1, { kernel: "nearest" })
      .raw()
      .toBuffer();
    const contentLum = (contentSample[0] + contentSample[1] + contentSample[2]) / 3;
    if (contentLum > 180) {
      r = 255;
      g = 255;
      b = 255;
    }
  }

  const overlay = await sharp({
    create: {
      width: coverW,
      height: coverH,
      channels: 3,
      background: { r, g, b },
    },
  })
    .png()
    .toBuffer();

  const out = await sharp(filePath)
    .composite([{ input: overlay, left, top }])
    .png({ compressionLevel: 9 })
    .toBuffer();
  await fs.writeFile(filePath, out);
  return { left, top, coverW, coverH, fill: [r, g, b] };
}

async function main() {
  let n = 0;
  for (const item of galleryItems) {
    if (canRebuildFromTemplate(item)) continue;
    const outName = item.file.replace(/^\/gallery\//, "");
    const outPath = path.join(galleryDir, outName);
    try {
      const info = await coverTopRightLogo(outPath);
      n += 1;
      console.log(`[ok] ${outName}`, info);
    } catch (err) {
      console.error(`[fail] ${outName}: ${err.message}`);
    }
  }
  console.log(`\nCovered logos on ${n} AI gallery cards`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
