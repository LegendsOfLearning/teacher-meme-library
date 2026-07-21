#!/usr/bin/env node
// Builds the Boromir gallery edit template: padded AI art with baked
// captions smudged once at build time (edit renders fresh Impact text).

import path from "node:path";
import { promises as fs } from "node:fs";
import sharp from "sharp";
import { getFormatById } from "../app/lib/meme-formats.js";
import {
  getRenderSize,
  padPngToSquare,
  smudgeCaptionZones,
} from "../app/lib/render.js";

const projectRoot = path.resolve(import.meta.dirname, "..");
const srcPath = path.resolve(
  projectRoot,
  "../../.cursor/projects/Users-morabreyaui-Code-teacher-meme-generator/assets/meme-boromir-backup.png"
);
const outPath = path.join(
  projectRoot,
  "public/templates-meme/one-does-not-simply-gallery.png"
);

const format = getFormatById("one-does-not-simply");
const zones = format.galleryZones || format.zones;
const size = getRenderSize(format);

const srcBuf = await fs.readFile(srcPath);
const padded = await padPngToSquare(srcBuf);
let baseBuf = await sharp(padded)
  .resize(size.width, size.height, { fit: "fill", kernel: sharp.kernel.lanczos3 })
  .toBuffer();

baseBuf = await smudgeCaptionZones(baseBuf, zones, size);

await fs.writeFile(outPath, baseBuf);
console.log(`Wrote ${outPath} (${size.width}x${size.height})`);
