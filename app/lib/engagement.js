// Gallery / community engagement for "Trending now", visible stats, and upvotes.
// Events: view, download, share, customize, upvote.
// Weights bias toward actions that mean a teacher actually used the meme.

import { promises as fs } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { list, put } from "@vercel/blob";

const EVENT_WEIGHTS = {
  view: 1,
  download: 4,
  share: 5,
  customize: 3,
  upvote: 2,
};

const DATA_PATH = path.join(process.cwd(), "data", "gallery-engagement.json");
const BLOB_PATH = "engagement/gallery.json";
const MAX_UPVOTE_KEYS = 800;

/** In-memory upvote rate limit (best-effort on serverless). */
const upvoteBuckets = new Map();

function blobEnabled() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

function useFilesystem() {
  return !process.env.VERCEL;
}

function emptyStore() {
  return { updatedAt: new Date().toISOString(), scores: {} };
}

function emptyRow() {
  return {
    score: 0,
    views: 0,
    downloads: 0,
    shares: 0,
    customizes: 0,
    upvotes: 0,
    upvoteKeys: [],
  };
}

function normalizeRow(row) {
  const base = { ...emptyRow(), ...(row || {}) };
  base.score = Number(base.score) || 0;
  base.views = Number(base.views) || 0;
  base.downloads = Number(base.downloads) || 0;
  base.shares = Number(base.shares) || 0;
  base.customizes = Number(base.customizes) || 0;
  base.upvotes = Number(base.upvotes) || 0;
  base.upvoteKeys = Array.isArray(base.upvoteKeys) ? base.upvoteKeys : [];
  return base;
}

export function publicEngagementStats(row) {
  const r = normalizeRow(row);
  return {
    views: r.views,
    downloads: r.downloads,
    shares: r.shares,
    customizes: r.customizes,
    upvotes: r.upvotes,
    uses: r.downloads + r.shares,
    score: r.score,
  };
}

async function readStoreFilesystem() {
  try {
    const raw = await fs.readFile(DATA_PATH, "utf8");
    const parsed = JSON.parse(raw);
    return parsed?.scores ? parsed : emptyStore();
  } catch (e) {
    if (e.code === "ENOENT") return emptyStore();
    throw e;
  }
}

async function writeStoreFilesystem(store) {
  await fs.mkdir(path.dirname(DATA_PATH), { recursive: true });
  await fs.writeFile(DATA_PATH, JSON.stringify(store, null, 2));
}

async function readStoreBlob() {
  try {
    const { blobs } = await list({ prefix: BLOB_PATH, limit: 1 });
    if (!blobs.length) return emptyStore();
    const res = await fetch(blobs[0].url, { cache: "no-store" });
    if (!res.ok) return emptyStore();
    const parsed = await res.json();
    return parsed?.scores ? parsed : emptyStore();
  } catch {
    return emptyStore();
  }
}

async function writeStoreBlob(store) {
  await put(BLOB_PATH, JSON.stringify(store), {
    access: "public",
    addRandomSuffix: false,
    contentType: "application/json",
  });
}

async function readStore() {
  if (blobEnabled()) return readStoreBlob();
  if (useFilesystem()) return readStoreFilesystem();
  return emptyStore();
}

async function writeStore(store) {
  if (blobEnabled()) return writeStoreBlob(store);
  if (useFilesystem()) return writeStoreFilesystem(store);
}

export function isEngagementMemeId(memeId) {
  return Boolean(memeId && /^[a-z0-9_-]{1,40}$/i.test(memeId));
}

/** Score map: { [memeId]: number } — used by Trending now. */
export async function getGalleryEngagementScores() {
  const store = await readStore();
  const out = {};
  for (const [id, row] of Object.entries(store.scores || {})) {
    out[id] = Number(row.score) || 0;
  }
  return out;
}

/** Full public stats map: { [memeId]: { views, uses, upvotes, ... } } */
export async function getGalleryEngagementStats() {
  const store = await readStore();
  const out = {};
  for (const [id, row] of Object.entries(store.scores || {})) {
    out[id] = publicEngagementStats(row);
  }
  return out;
}

export function mergeEngagementOntoItem(item, statsMap = {}) {
  const row = statsMap[item.id] || {};
  const communityViews = item.isCommunity ? Number(item.views) || 0 : 0;
  const trackedViews = Number(row.views) || 0;
  return {
    ...item,
    views: Math.max(communityViews, trackedViews),
    uses: Number(row.uses) || 0,
    upvotes: Number(row.upvotes) || 0,
    downloads: Number(row.downloads) || 0,
    shares: Number(row.shares) || 0,
  };
}

function hashVoterKey(voterId) {
  return createHash("sha256").update(String(voterId)).digest("hex").slice(0, 24);
}

function allowUpvoteRequest(ip) {
  const key = ip || "unknown";
  const now = Date.now();
  const bucket = upvoteBuckets.get(key) || { count: 0, resetAt: now + 60_000 };
  if (now > bucket.resetAt) {
    bucket.count = 0;
    bucket.resetAt = now + 60_000;
  }
  bucket.count += 1;
  upvoteBuckets.set(key, bucket);
  // Light cap: ~20 upvote attempts / minute / IP
  return bucket.count <= 20;
}

/**
 * Bump engagement for a curated gallery or community meme.
 * @param {string} memeId
 * @param {'view'|'download'|'share'|'customize'|'upvote'} event
 * @param {{ voterId?: string, ip?: string }} [opts]
 */
export async function incrementGalleryEngagement(
  memeId,
  event = "view",
  opts = {}
) {
  if (!isEngagementMemeId(memeId)) return null;
  if (!EVENT_WEIGHTS[event]) return null;

  const store = await readStore();
  const row = normalizeRow(store.scores[memeId]);

  if (event === "upvote") {
    const voterId = String(opts.voterId || "").trim();
    if (!/^[a-z0-9_-]{8,80}$/i.test(voterId)) {
      return { error: "voter_required", stats: publicEngagementStats(row) };
    }
    if (!allowUpvoteRequest(opts.ip)) {
      return { error: "rate_limited", stats: publicEngagementStats(row) };
    }
    const key = hashVoterKey(voterId);
    if (row.upvoteKeys.includes(key)) {
      return {
        error: "already_upvoted",
        stats: publicEngagementStats(row),
      };
    }
    row.upvoteKeys = [...row.upvoteKeys, key].slice(-MAX_UPVOTE_KEYS);
    row.upvotes += 1;
  }

  const weight = EVENT_WEIGHTS[event];
  row.score = (row.score || 0) + weight;
  if (event === "view") row.views += 1;
  if (event === "download") row.downloads += 1;
  if (event === "share") row.shares += 1;
  if (event === "customize") row.customizes += 1;

  store.scores[memeId] = row;
  store.updatedAt = new Date().toISOString();
  await writeStore(store);
  return { stats: publicEngagementStats(row) };
}
