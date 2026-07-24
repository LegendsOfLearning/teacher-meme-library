"use client";

const VOTER_KEY = "tmg-voter-id";
const UPVOTED_PREFIX = "tmg-upvoted:";

function randomId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID().replace(/-/g, "");
  }
  return `v${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

export function getVoterId() {
  try {
    let id = localStorage.getItem(VOTER_KEY);
    if (!id || id.length < 8) {
      id = randomId();
      localStorage.setItem(VOTER_KEY, id);
    }
    return id;
  } catch {
    return randomId();
  }
}

export function hasLocalUpvote(memeId) {
  try {
    return localStorage.getItem(`${UPVOTED_PREFIX}${memeId}`) === "1";
  } catch {
    return false;
  }
}

export function markLocalUpvote(memeId) {
  try {
    localStorage.setItem(`${UPVOTED_PREFIX}${memeId}`, "1");
  } catch {
    // ignore quota / private mode
  }
}

/** Fire-and-forget engagement event for gallery + community memes. */
export function trackEngagement(memeId, event, extra = {}) {
  if (!memeId || String(memeId).startsWith("gallery-")) return;
  if (!/^[a-z0-9_-]{1,40}$/i.test(memeId)) return;
  const body = { memeId, event, ...extra };
  if (event === "upvote") {
    body.voterId = getVoterId();
  }
  return fetch("/api/engagement", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    keepalive: true,
  }).catch(() => null);
}

export function formatStatCount(n) {
  const v = Number(n) || 0;
  if (v < 1000) return String(v);
  if (v < 10_000) return `${(v / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  return `${Math.round(v / 1000)}k`;
}
