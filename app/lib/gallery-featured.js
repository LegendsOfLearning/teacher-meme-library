import { isIpSensitiveFormat } from "./ip-safe-formats";

/** Stable daily index from gallery id + calendar date (UTC). */
function dailySeed() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`;
}

function hashString(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

/** Prefer classroom-safe templates for hero carousels. */
export function filterFeaturedPool(items) {
  return items.filter((item) => !isIpSensitiveFormat(item.remixFormatId));
}

export function getMemeOfTheDay(items) {
  const pool = filterFeaturedPool(items);
  const list = pool.length > 0 ? pool : items;
  if (list.length === 0) return null;
  const idx = hashString(dailySeed()) % list.length;
  return list[idx];
}

/** Rotating “hot” set — daily shuffle, IP-safe first. */
export function getHotMemes(items, count = 6) {
  const pool = filterFeaturedPool(items);
  const list = pool.length > 0 ? pool : [...items];
  const seed = hashString(dailySeed() + "-hot");
  const sorted = [...list].sort(
    (a, b) => hashString(a.id + seed) - hashString(b.id + seed)
  );
  return sorted.slice(0, Math.min(count, sorted.length));
}

/** User-saved memes that are not dev/placeholder drafts. */
export function isPlaceholderMeme(record) {
  const parts = Object.values(record.captions || {})
    .map((s) => (typeof s === "string" ? s.trim() : ""))
    .filter(Boolean);
  if (parts.length === 0) return true;

  const joined = parts.join(" ").toLowerCase();
  const junkPatterns = [
    /\bhello\s*test\b/i,
    /\btest!!+\b/i,
    /\btesttt+\b/i,
    /\bhelooo+\b/i,
    /\btesting\s+this/i,
    /\bhol{2,}a+\b/i,
    /^test$/i,
    /placeholder/i,
  ];
  if (junkPatterns.some((p) => p.test(joined))) return true;
  if (parts.every((p) => p.length < 5)) return true;
  return false;
}

export function filterCommunityRecords(records) {
  return records.filter((r) => !isPlaceholderMeme(r));
}

export function communityMemeToGalleryItem(record) {
  const parts = Object.values(record.captions || {})
    .map((s) => (typeof s === "string" ? s.trim() : ""))
    .filter(Boolean);
  const captionPreview =
    parts.join(" / ").slice(0, 120) || record.formatName || "Teacher meme";

  return {
    id: record.id,
    file: record.pngUrl,
    formatName: record.formatName,
    captionPreview,
    remixFormatId: null,
    captions: null,
    customizable: false,
    situations: [],
    pagePath: record.sharePath || `/meme/${record.id}`,
    views: record.views || 0,
    isCommunity: true,
  };
}

/** Curated gallery picks when community saves are empty or test-only. */
export function getCuratedStaffPicks(items, { excludeIds = [], count = 4 } = {}) {
  const pool = filterFeaturedPool(items).filter(
    (i) => !excludeIds.includes(i.id)
  );
  const seed = hashString(dailySeed() + "-staff");
  const sorted = [...pool].sort(
    (a, b) => hashString(a.id + seed) - hashString(b.id + seed)
  );
  return sorted.slice(0, Math.min(count, sorted.length));
}

export function getFavoritesForHome(
  galleryItems,
  communityRecords,
  { excludeIds = [], count = 4 } = {}
) {
  const polished = filterCommunityRecords(communityRecords)
    .sort((a, b) => (b.views || 0) - (a.views || 0))
    .slice(0, count)
    .map(communityMemeToGalleryItem);

  if (polished.length >= 2) return polished;

  return getCuratedStaffPicks(galleryItems, { excludeIds, count });
}
