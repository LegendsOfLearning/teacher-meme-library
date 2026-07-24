#!/usr/bin/env node
// Crop meme templates that ship with a baked-in white caption band at the top.
// Those bands were meant for dark-on-light text; our renderer uses Impact
// captions overlaid on the photo, so the white area reads as a broken layout.

import path from "node:path";
import { promises as fs } from "node:fs";
import sharp from "sharp";

const projectRoot = path.resolve(import.meta.dirname, "..");
const templateDir = path.join(projectRoot, "public", "templates-meme");

/** @type {{ src: string, topPx: number, out?: string }[]} */
const CROPS = [
  {
    src: "woman-yelling-at-cat.jpg",
    topPx: 98,
    out: "woman-yelling-at-cat.jpg",
  },
  {
    src: "surprised-pikachu.jpg",
    topPx: 762,
    out: "surprised-pikachu.jpg",
  },
  {
    src: "monkey-puppet.jpg",
    topPx: 281,
    out: "monkey-puppet-clean.jpg",
  },
];

async function cropTopBand(srcName, topPx, outName) {
  const inPath = path.join(templateDir, srcName);
  const outPath = path.join(templateDir, outName);
  const meta = await sharp(inPath).metadata();
  const height = meta.height - topPx;
  if (height < 32) throw new Error(`${srcName}: crop too aggressive`);

  const tmpPath = `${outPath}.tmp`;
  await sharp(inPath)
    .extract({ left: 0, top: topPx, width: meta.width, height })
    .jpeg({ quality: 92, mozjpeg: true })
    .toFile(tmpPath);
  await fs.rename(tmpPath, outPath);
  console.log(
    `[ok] ${outName}: ${meta.width}x${meta.height} -> ${meta.width}x${height} (cropped ${topPx}px top band)`
  );
  return { width: meta.width, height };
}

async function main() {
  for (const job of CROPS) {
    await cropTopBand(job.src, job.topPx, job.out || job.src);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
