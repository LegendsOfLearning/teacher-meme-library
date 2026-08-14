// Gallery / community engagement for "Trending now", visible stats, and upvotes.
// Events: view, download, share, customize, upvote, unupvote.
// Weights bias toward actions that mean a teacher actually used the meme.
//
// On Vercel Blob (public store), overwriting a single JSON file is not
// read-after-write consistent (CDN can serve a stale body with a fresh etag).
// Engagement therefore uses append-only paths:
//   engagement/upvotes/{memeId}/{voterKey}.json
//   engagement/evt/{event}/{memeId}/{id}.json
//   engagement/seed/{memeId}.json  (one-time migration from legacy gallery.json)

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash, randomBytes } from "node:crypto";
import { put, head, list, del } from "@vercel/blob";

const EVENT_WEIGHTS = {
  view: 1,
  download: 4,
  share: 5,
  customize: 3,
  upvote: 2,
};

const DATA_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "data",
  "gallery-engagement.json"
);
const LEGACY_BLOB_PATH = "engagement/gallery.json";
const UPVOTE_PREFIX = "engagement/upvotes/";
const EVT_PREFIX = "engagement/evt/";
const SEED_PREFIX = "engagement/seed/";

/** In-memory upvote rate limit (best-effort on serverless). */
const upvoteBuckets = new Map();

/** Short TTL cache for aggregated stats (serverless instance). */
let statsCache = { at: 0, store: null };
const STATS_TTL_MS = 8_000;
let migratePromise = null;

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

function recomputeScore(row) {
  return (
    row.views * EVENT_WEIGHTS.view +
    row.downloads * EVENT_WEIGHTS.download +
    row.shares * EVENT_WEIGHTS.share +
    row.customizes * EVENT_WEIGHTS.customize +
    row.upvotes * EVENT_WEIGHTS.upvote
  );
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

async function listAll(prefix) {
  const blobs = [];
  let cursor;
  do {
    const page = await list({ prefix, cursor, limit: 1000 });
    blobs.push(...page.blobs);
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  return blobs;
}

async function readLegacyBlob() {
  try {
    const meta = await head(LEGACY_BLOB_PATH);
    const res = await fetch(`${meta.url}?v=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) return null;
    const parsed = await res.json();
    return parsed?.scores ? parsed : null;
  } catch {
    return null;
  }
}

async function migrateLegacyOnce() {
  if (migratePromise) return migratePromise;
  migratePromise = (async () => {
    const legacy = await readLegacyBlob();
    if (!legacy?.scores) return;

    const existingSeeds = await listAll(SEED_PREFIX);
    const seededIds = new Set(
      existingSeeds.map((b) => b.pathname.split("/")[2]?.replace(/\.json$/, ""))
    );

    for (const [memeId, raw] of Object.entries(legacy.scores)) {
      if (!isEngagementMemeId(memeId)) continue;
      const row = normalizeRow(raw);

      for (const key of row.upvoteKeys) {
        if (!/^[a-f0-9]{8,64}$/i.test(key)) continue;
        try {
          await put(
            `${UPVOTE_PREFIX}${memeId}/${key}.json`,
            JSON.stringify({ migrated: true, at: legacy.updatedAt }),
            {
              access: "public",
              addRandomSuffix: false,
              allowOverwrite: false,
              contentType: "application/json",
              cacheControlMaxAge: 60,
            }
          );
        } catch {
          // already exists
        }
      }

      if (seededIds.has(memeId)) continue;
      const seed = {
        views: row.views,
        downloads: row.downloads,
        shares: row.shares,
        customizes: row.customizes,
        // upvotes come from upvote files after key migration
      };
      if (
        seed.views ||
        seed.downloads ||
        seed.shares ||
        seed.customizes
      ) {
        try {
          await put(`${SEED_PREFIX}${memeId}.json`, JSON.stringify(seed), {
            access: "public",
            addRandomSuffix: false,
            allowOverwrite: false,
            contentType: "application/json",
            cacheControlMaxAge: 60,
          });
          seededIds.add(memeId);
        } catch {
          // already exists
        }
      }
    }
  })().catch((e) => {
    migratePromise = null;
    console.error("[engagement] legacy migrate failed", e?.message || e);
  });
  return migratePromise;
}

async function aggregateBlobStore() {
  await migrateLegacyOnce();

  const store = emptyStore();
  const ensure = (id) => {
    if (!store.scores[id]) store.scores[id] = emptyRow();
    return store.scores[id];
  };

  const [seeds, upvotes, events] = await Promise.all([
    listAll(SEED_PREFIX),
    listAll(UPVOTE_PREFIX),
    listAll(EVT_PREFIX),
  ]);

  for (const blob of seeds) {
    // engagement/seed/{memeId}.json
    const memeId = blob.pathname.split("/")[2]?.replace(/\.json$/, "");
    if (!isEngagementMemeId(memeId)) continue;
    try {
      const res = await fetch(`${blob.url}?v=${blob.uploadedAt || Date.now()}`, {
        cache: "no-store",
      });
      if (!res.ok) continue;
      const seed = await res.json();
      const row = ensure(memeId);
      row.views += Number(seed.views) || 0;
      row.downloads += Number(seed.downloads) || 0;
      row.shares += Number(seed.shares) || 0;
      row.customizes += Number(seed.customizes) || 0;
    } catch {
      // skip bad seed
    }
  }

  for (const blob of upvotes) {
    // engagement/upvotes/{memeId}/{voterKey}.json
    const parts = blob.pathname.split("/");
    const memeId = parts[2];
    const voterKey = parts[3]?.replace(/\.json$/, "");
    if (!isEngagementMemeId(memeId) || !voterKey) continue;
    const row = ensure(memeId);
    row.upvotes += 1;
    if (row.upvoteKeys.length < 40) row.upvoteKeys.push(voterKey);
  }

  for (const blob of events) {
    // engagement/evt/{event}/{memeId}/{id}.json
    const parts = blob.pathname.split("/");
    const event = parts[2];
    const memeId = parts[3];
    if (!EVENT_WEIGHTS[event] || event === "upvote") continue;
    if (!isEngagementMemeId(memeId)) continue;
    const row = ensure(memeId);
    if (event === "view") row.views += 1;
    else if (event === "download") row.downloads += 1;
    else if (event === "share") row.shares += 1;
    else if (event === "customize") row.customizes += 1;
  }

  for (const row of Object.values(store.scores)) {
    row.score = recomputeScore(row);
  }
  store.updatedAt = new Date().toISOString();
  return store;
}

async function readStoreBlob({ bypassCache = false } = {}) {
  const now = Date.now();
  if (!bypassCache && statsCache.store && now - statsCache.at < STATS_TTL_MS) {
    return statsCache.store;
  }
  const store = await aggregateBlobStore();
  statsCache = { at: now, store };
  return store;
}

function invalidateStatsCache() {
  statsCache = { at: 0, store: null };
}

async function appendEventBlob(memeId, event) {
  const id = `${Date.now().toString(36)}-${randomBytes(4).toString("hex")}`;
  await put(`${EVT_PREFIX}${event}/${memeId}/${id}.json`, "{}", {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: false,
    contentType: "application/json",
    cacheControlMaxAge: 60,
  });
}

async function putUpvoteBlob(memeId, upvoteKey) {
  await put(
    `${UPVOTE_PREFIX}${memeId}/${upvoteKey}.json`,
    JSON.stringify({ at: new Date().toISOString() }),
    {
      access: "public",
      addRandomSuffix: false,
      allowOverwrite: false,
      contentType: "application/json",
      cacheControlMaxAge: 60,
    }
  );
}

async function deleteUpvoteBlob(memeId, upvoteKey) {
  try {
    await del(`${UPVOTE_PREFIX}${memeId}/${upvoteKey}.json`);
    return true;
  } catch {
    return false;
  }
}

async function upvoteExists(memeId, upvoteKey) {
  try {
    await head(`${UPVOTE_PREFIX}${memeId}/${upvoteKey}.json`);
    return true;
  } catch {
    return false;
  }
}

async function readStore({ bypassCache = false } = {}) {
  if (blobEnabled()) return readStoreBlob({ bypassCache });
  if (useFilesystem()) return readStoreFilesystem();
  return emptyStore();
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
 * @param {'view'|'download'|'share'|'customize'|'upvote'|'unupvote'} event
 * @param {{ voterId?: string, ip?: string }} [opts]
 */
export async function incrementGalleryEngagement(
  memeId,
  event = "view",
  opts = {}
) {
  if (!isEngagementMemeId(memeId)) return null;
  if (event !== "unupvote" && !EVENT_WEIGHTS[event]) return null;

  let upvoteKey = null;
  if (event === "upvote" || event === "unupvote") {
    const voterId = String(opts.voterId || "").trim();
    if (!/^[a-z0-9_-]{8,80}$/i.test(voterId)) {
      return { error: "voter_required", stats: publicEngagementStats(emptyRow()) };
    }
    if (!allowUpvoteRequest(opts.ip)) {
      return { error: "rate_limited", stats: publicEngagementStats(emptyRow()) };
    }
    upvoteKey = hashVoterKey(voterId);
  }

  // --- Blob append-only path (production) ---
  if (blobEnabled()) {
    if (event === "upvote") {
      if (await upvoteExists(memeId, upvoteKey)) {
        const store = await readStore({ bypassCache: true });
        return {
          error: "already_upvoted",
          stats: publicEngagementStats(store.scores[memeId] || emptyRow()),
        };
      }
      try {
        await putUpvoteBlob(memeId, upvoteKey);
      } catch (e) {
        if (/already exists/i.test(String(e?.message || ""))) {
          const store = await readStore({ bypassCache: true });
          return {
            error: "already_upvoted",
            stats: publicEngagementStats(store.scores[memeId] || emptyRow()),
          };
        }
        throw e;
      }
    } else if (event === "unupvote") {
      const existed = await upvoteExists(memeId, upvoteKey);
      if (!existed) {
        const store = await readStore({ bypassCache: true });
        return {
          error: "not_upvoted",
          stats: publicEngagementStats(store.scores[memeId] || emptyRow()),
        };
      }
      await deleteUpvoteBlob(memeId, upvoteKey);
    } else {
      await appendEventBlob(memeId, event);
    }

    invalidateStatsCache();
    const store = await readStore({ bypassCache: true });
    return { stats: publicEngagementStats(store.scores[memeId] || emptyRow()) };
  }

  // --- Local filesystem path ---
  if (!useFilesystem()) {
    return { stats: publicEngagementStats(emptyRow()) };
  }

  const store = await readStoreFilesystem();
  const row = normalizeRow(store.scores[memeId]);

  if (event === "upvote") {
    if (row.upvoteKeys.includes(upvoteKey)) {
      return {
        error: "already_upvoted",
        stats: publicEngagementStats(row),
      };
    }
    row.upvoteKeys = [...row.upvoteKeys, upvoteKey].slice(-800);
    row.upvotes += 1;
  } else if (event === "unupvote") {
    if (!row.upvoteKeys.includes(upvoteKey)) {
      return {
        error: "not_upvoted",
        stats: publicEngagementStats(row),
      };
    }
    row.upvoteKeys = row.upvoteKeys.filter((k) => k !== upvoteKey);
    row.upvotes = Math.max(0, (Number(row.upvotes) || 0) - 1);
  }

  if (event === "view") row.views += 1;
  if (event === "download") row.downloads += 1;
  if (event === "share") row.shares += 1;
  if (event === "customize") row.customizes += 1;
  row.score = recomputeScore(row);

  store.scores[memeId] = row;
  store.updatedAt = new Date().toISOString();
  await writeStoreFilesystem(store);
  return { stats: publicEngagementStats(row) };
}
