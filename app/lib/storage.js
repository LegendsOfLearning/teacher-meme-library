// Meme persistence — filesystem locally, Vercel Blob in production.
//
// Each meme is saved as two artifacts:
//   - memes/<id>.png   — rendered image (public URL)
//   - memes/<id>.json  — metadata for /meme/<id> share pages
//
// Local dev writes under public/memes + data/memes. On Vercel, set
// BLOB_READ_WRITE_TOKEN (auto when you attach a Blob store). Without
// Blob on Vercel, save still succeeds but returns an inline data URL
// so customize/download work; share links won't persist.

import { promises as fs } from "node:fs";
import path from "node:path";
import { customAlphabet } from "nanoid";
import { list, put } from "@vercel/blob";

const nanoid = customAlphabet(
  "23456789abcdefghjkmnpqrstuvwxyz",
  10
);

const PUBLIC_MEMES_DIR = path.join(process.cwd(), "public", "memes");
const DATA_MEMES_DIR = path.join(process.cwd(), "data", "memes");

function blobEnabled() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

function useFilesystem() {
  return !process.env.VERCEL;
}

async function ensureDirs() {
  await fs.mkdir(PUBLIC_MEMES_DIR, { recursive: true });
  await fs.mkdir(DATA_MEMES_DIR, { recursive: true });
}

export function newMemeId() {
  return nanoid();
}

function buildRecord(id, format, captions, meta, pngUrl) {
  return {
    id,
    formatId: format.id,
    formatName: format.name,
    captions,
    pngUrl,
    sharePath: `/meme/${id}`,
    createdAt: new Date().toISOString(),
    views: 0,
    ...meta,
  };
}

async function saveMemeFilesystem({ id, pngBuffer, format, captions, meta }) {
  await ensureDirs();
  const pngPath = path.join(PUBLIC_MEMES_DIR, `${id}.png`);
  const jsonPath = path.join(DATA_MEMES_DIR, `${id}.json`);
  const record = buildRecord(
    id,
    format,
    captions,
    meta,
    `/memes/${id}.png`
  );

  await fs.writeFile(pngPath, pngBuffer);
  await fs.writeFile(jsonPath, JSON.stringify(record, null, 2));
  return record;
}

async function saveMemeBlob({ id, pngBuffer, format, captions, meta }) {
  const { url: pngUrl } = await put(`memes/${id}.png`, pngBuffer, {
    access: "public",
    addRandomSuffix: false,
    contentType: "image/png",
  });
  const record = buildRecord(id, format, captions, meta, pngUrl);
  await put(`memes/${id}.json`, JSON.stringify(record), {
    access: "public",
    addRandomSuffix: false,
    contentType: "application/json",
  });
  return record;
}

function saveMemeEphemeral({ id, pngBuffer, format, captions, meta }) {
  const pngUrl = `data:image/png;base64,${pngBuffer.toString("base64")}`;
  return {
    ...buildRecord(id, format, captions, meta, pngUrl),
    ephemeral: true,
  };
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
  const payload = { id, pngBuffer, format, captions, meta };
  if (blobEnabled()) return saveMemeBlob(payload);
  if (useFilesystem()) return saveMemeFilesystem(payload);
  return saveMemeEphemeral(payload);
}

async function getMemeFilesystem(id) {
  try {
    const jsonPath = path.join(DATA_MEMES_DIR, `${id}.json`);
    const raw = await fs.readFile(jsonPath, "utf8");
    return JSON.parse(raw);
  } catch (e) {
    if (e.code === "ENOENT") return null;
    throw e;
  }
}

async function getMemeBlob(id) {
  const { blobs } = await list({
    prefix: `memes/${id}.json`,
    limit: 1,
  });
  if (!blobs.length) return null;
  try {
    const res = await fetch(blobs[0].url, { cache: "no-store" });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function getMeme(id) {
  if (!id || !/^[a-z0-9_-]{4,40}$/i.test(id)) return null;
  if (blobEnabled()) return getMemeBlob(id);
  if (useFilesystem()) return getMemeFilesystem(id);
  return null;
}

async function listMemesFilesystem(limit) {
  await ensureDirs();
  const files = await fs.readdir(DATA_MEMES_DIR);
  const records = [];
  for (const f of files) {
    if (!f.endsWith(".json")) continue;
    try {
      const raw = await fs.readFile(path.join(DATA_MEMES_DIR, f), "utf8");
      records.push(JSON.parse(raw));
    } catch {
      // Skip unreadable records — best-effort listing.
    }
  }
  return sortAndLimitMemes(records, limit);
}

async function listMemesBlob(limit) {
  const { blobs } = await list({ prefix: "memes/" });
  const records = [];
  for (const blob of blobs) {
    if (!blob.pathname.endsWith(".json")) continue;
    try {
      const res = await fetch(blob.url, { cache: "no-store" });
      if (!res.ok) continue;
      records.push(await res.json());
    } catch {
      // Skip unreadable records.
    }
  }
  return sortAndLimitMemes(records, limit);
}

function sortAndLimitMemes(records, limit) {
  records.sort((a, b) => {
    const viewDiff = (b.views || 0) - (a.views || 0);
    if (viewDiff !== 0) return viewDiff;
    return (b.createdAt || "").localeCompare(a.createdAt || "");
  });
  return records.slice(0, limit);
}

export async function listMemes(limit = 24) {
  if (blobEnabled()) return listMemesBlob(limit);
  if (useFilesystem()) return listMemesFilesystem(limit);
  return [];
}

async function incrementMemeViewsFilesystem(id) {
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

async function incrementMemeViewsBlob(id) {
  const record = await getMemeBlob(id);
  if (!record) return null;
  record.views = (record.views || 0) + 1;
  await put(`memes/${id}.json`, JSON.stringify(record), {
    access: "public",
    addRandomSuffix: false,
    contentType: "application/json",
  });
  return record.views;
}

/** Bump view count when a share page is opened (engagement sort). */
export async function incrementMemeViews(id) {
  if (!id || !/^[a-z0-9_-]{4,40}$/i.test(id)) return null;
  if (blobEnabled()) return incrementMemeViewsBlob(id);
  if (useFilesystem()) return incrementMemeViewsFilesystem(id);
  return null;
}
