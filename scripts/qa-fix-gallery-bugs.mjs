#!/usr/bin/env node
// QA pass: re-render specific gallery cards from blank templates,
// seed Boromir variants, and scrub the First World Problems logo.

import path from "node:path";
import { promises as fs } from "node:fs";
import sharp from "sharp";
import { galleryItems } from "../app/lib/gallery.js";
import { getFormatById } from "../app/lib/meme-formats.js";
import {
  renderMeme,
  detectLetterboxBandBounds,
} from "../app/lib/render.js";

const projectRoot = path.resolve(import.meta.dirname || ".", "..");
const outDir = path.join(projectRoot, "public", "gallery");

const RERENDER_FORMATS = new Set([
  "hide-the-pain-harold",
  "this-is-fine",
  "distracted-boyfriend",
  "one-does-not-simply",
]);

async function coverTopRightLogo(filePath) {
  const meta = await sharp(filePath).metadata();
  const W = meta.width;
  const H = meta.height;
  const bounds = await detectLetterboxBandBounds(await fs.readFile(filePath));
  const contentTop = Math.round((bounds.topEndFrac || 0) * H);
  const contentBottom = Math.round((bounds.bottomStartFrac || 1) * H);
  const contentH = Math.max(40, contentBottom - contentTop);

  const coverW = Math.round(W * 0.14);
  const coverH = Math.round(contentH * 0.14);
  const left = W - coverW - Math.round(W * 0.015);
  const top = contentTop + Math.round(contentH * 0.02);

  const sample = await sharp(filePath)
    .extract({
      left: Math.max(0, left - Math.round(coverW * 0.5)),
      top: top + Math.round(coverH * 0.25),
      width: Math.max(8, Math.round(coverW * 0.25)),
      height: Math.max(8, Math.round(coverH * 0.35)),
    })
    .resize(1, 1, { kernel: "nearest" })
    .raw()
    .toBuffer();

  let [r, g, b] = sample;
  if ((r + g + b) / 3 < 50) {
    r = g = b = 255;
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
  return { left, top, coverW, coverH };
}

async function main() {
  await fs.mkdir(outDir, { recursive: true });
  let ok = 0;
  let fail = 0;

  for (const item of galleryItems) {
    if (!item.remixFormatId || !item.captions) continue;
    if (!RERENDER_FORMATS.has(item.remixFormatId)) continue;
    const format = getFormatById(item.remixFormatId);
    if (!format) continue;
    try {
      const buf = await renderMeme(format, item.captions, {
        cleanBase: item.cleanBase || format.renderFile || format.file,
      });
      const outPath = path.join(
        outDir,
        item.file.replace(/^\/gallery\//, "")
      );
      await fs.writeFile(outPath, buf);
      ok += 1;
      console.log(`[ok] ${item.id} -> ${path.basename(outPath)}`);
    } catch (err) {
      fail += 1;
      console.error(`[fail] ${item.id}: ${err.message}`);
    }
  }

  const fwp = path.join(outDir, "first-world-copier.png");
  try {
    const info = await coverTopRightLogo(fwp);
    console.log("[ok] stripped LoL logo from first-world-copier.png", info);
  } catch (err) {
    fail += 1;
    console.error(`[fail] first-world logo: ${err.message}`);
  }

  // Best-effort remove the Pablo gallery card from disk.
  try {
    await fs.unlink(path.join(outDir, "sad-pablo-turn-in-work.png"));
    console.log("[ok] removed sad-pablo-turn-in-work.png");
  } catch {
    /* already gone */
  }

  console.log(`\nDone: ${ok} rendered, ${fail} failed`);
  if (fail > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
