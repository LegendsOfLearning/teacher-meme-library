// File-based permanent storage for generated memes.
//
// Each meme is saved as two artifacts:
//   - public/memes/<id>.png        — the rendered image (publicly served)
//   - data/memes/<id>.json         — metadata: format, captions, situation,
//                                    tone, createdAt, plus the agentic
//                                    workflow's debug trace (steps, scores).
//
// The /meme/<id> route reads the JSON to render share pages.
// In production you'd swap this for S3 / R2 / Vercel Blob — the same
// API surface (saveMeme / getMeme / listMemes) would still apply.

import { promises as fs } from "node:fs";
import path from "node:path";
import { customAlphabet } from "nanoid";

// Friendly URL-safe IDs: 10 chars, no ambiguous letters.
const nanoid = customAlphabet(
  "23456789abcdefghjkmnpqrstuvwxyz",
  10
);

const PUBLIC_MEMES_DIR = path.join(process.cwd(), "public", "memes");
const DATA_MEMES_DIR = path.join(process.cwd(), "data", "memes");

async function ensureDirs() {
  await fs.mkdir(PUBLIC_MEMES_DIR, { recursive: true });
  await fs.mkdir(DATA_MEMES_DIR, { recursive: true });
}

export function newMemeId() {
  return nanoid();
}

/**
 * Persist a generated meme.
 *
 * @param {object} args
 * @param {string} args.id           Pre-allocated ID (also used as filename).
 * @param {Buffer} args.pngBuffer    Final rendered PNG.
 * @param {object} args.format       Meme format used.
 * @param {object} args.captions     Filled-in caption map (zone key -> text).
 * @param {object} [args.meta]       Extra metadata (situation, tone, trace, etc.).
 */
export async function saveMeme({ id, pngBuffer, format, captions, meta = {} }) {
  await ensureDirs();
  const pngPath = path.join(PUBLIC_MEMES_DIR, `${id}.png`);
  const jsonPath = path.join(DATA_MEMES_DIR, `${id}.json`);

  const record = {
    id,
    formatId: format.id,
    formatName: format.name,
    captions,
    pngUrl: `/memes/${id}.png`,
    sharePath: `/meme/${id}`,
    createdAt: new Date().toISOString(),
    views: 0,
    ...meta,
  };

  await fs.writeFile(pngPath, pngBuffer);
  await fs.writeFile(jsonPath, JSON.stringify(record, null, 2));

  return record;
}

export async function getMeme(id) {
  if (!id || !/^[a-z0-9_-]{4,40}$/i.test(id)) return null;
  try {
    const jsonPath = path.join(DATA_MEMES_DIR, `${id}.json`);
    const raw = await fs.readFile(jsonPath, "utf8");
    return JSON.parse(raw);
  } catch (e) {
    if (e.code === "ENOENT") return null;
    throw e;
  }
}

export async function listMemes(limit = 24) {
  await ensureDirs();
  const files = await fs.readdir(DATA_MEMES_DIR);
  const records = [];
  for (const f of files) {
    if (!f.endsWith(".json")) continue;
    try {
      const raw = await fs.readFile(path.join(DATA_MEMES_DIR, f), "utf8");
      records.push(JSON.parse(raw));
    } catch {
      // Skip unreadable records — this is a best-effort listing.
    }
  }
  records.sort((a, b) => {
    const viewDiff = (b.views || 0) - (a.views || 0);
    if (viewDiff !== 0) return viewDiff;
    return (b.createdAt || "").localeCompare(a.createdAt || "");
  });
  return records.slice(0, limit);
}

/** Bump view count when a share page is opened (engagement sort). */
export async function incrementMemeViews(id) {
  if (!id || !/^[a-z0-9_-]{4,40}$/i.test(id)) return null;
  const jsonPath = path.join(DATA_MEMES_DIR, `${id}.json`);
  try {
    const raw = await fs.readFile(jsonPath, "utf8");
    const record = JSON.parse(raw);
    record.views = (record.views || 0) + 1;
    await fs.writeFile(jsonPath, JSON.stringify(record, null, 2));
    return record.views;
  } catch (e) {
    if (e.code === "ENOENT") return null;
    throw e;
  }
}
