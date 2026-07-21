#!/usr/bin/env node
import { galleryItems } from "../app/lib/gallery.js";
import { getFormatById } from "../app/lib/meme-formats.js";
import { promises as fs } from "node:fs";
import path from "node:path";

const picks = [];
const seenFormats = new Set();
for (const item of galleryItems) {
  if (!item.remixFormatId || !item.captions || item.customizable === false) continue;
  const fmt = getFormatById(item.remixFormatId);
  if (!fmt) continue;
  if (item.featured || !seenFormats.has(item.remixFormatId)) {
    seenFormats.add(item.remixFormatId);
    const captions = {};
    for (const z of fmt.zones) {
      if (z.decorative) continue;
      if (z.key === "p3") {
        captions[z.key] = "";
        continue;
      }
      captions[z.key] = `Test ${z.key}`;
    }
    if (!Object.values(captions).some((v) => String(v).trim())) continue;
    picks.push({
      id: item.id,
      formatId: item.remixFormatId,
      galleryFile: item.file,
      captions,
      situationId: item.situations?.[0] || "lesson-planning",
    });
  }
}

const outDir = path.join(process.cwd(), "tmp-smoke", "customize-qa");
await fs.mkdir(outDir, { recursive: true });

console.log(`Testing ${picks.length} customize API calls...\n`);
const results = [];

for (let i = 0; i < picks.length; i++) {
  const p = picks[i];
  const t0 = Date.now();
  let ok = false;
  let err = null;
  let memeId = null;
  let pngUrl = null;
  try {
    const res = await fetch("http://127.0.0.1:3001/api/edit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        formatId: p.formatId,
        captions: p.captions,
        galleryFile: p.galleryFile,
        situationId: p.situationId,
        toneId: "relatable",
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      err = data.error || JSON.stringify(data).slice(0, 200);
    } else {
      ok = true;
      memeId = data.id;
      pngUrl = data.pngUrl;
      if (pngUrl) {
        const img = await fetch(`http://127.0.0.1:3001${pngUrl}`);
        const buf = Buffer.from(await img.arrayBuffer());
        await fs.writeFile(
          path.join(outDir, `${p.id}-${p.formatId}.png`),
          buf
        );
      }
    }
  } catch (e) {
    err = e.message;
  }
  const dt = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(
    `[${ok ? "OK" : "FAIL"}] ${String(i + 1).padStart(2)}/${picks.length} ${p.id.padEnd(4)} ${p.formatId.padEnd(28)} ${dt}s ${err || memeId}`
  );
  results.push({
    id: p.id,
    format: p.formatId,
    ok,
    error: err,
    memeId,
    png: pngUrl,
  });
}

const failed = results.filter((r) => !r.ok);
console.log(
  `\nSummary: ${results.length - failed.length}/${results.length} ok, ${failed.length} failed`
);
if (failed.length) {
  console.log("FAILURES:");
  for (const f of failed) console.log(" -", f.id, f.format, f.error);
  process.exit(1);
}

await fs.writeFile(
  "/tmp/customize-results.json",
  JSON.stringify(results, null, 2)
);
