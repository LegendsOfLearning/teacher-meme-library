/** Lowercase haystack for client-side gallery search. */
export function galleryItemSearchText(item) {
  const parts = [
    item.formatName,
    item.captionPreview,
    ...(item.searchKeywords || []),
    ...Object.values(item.captions || {}),
  ];
  return parts
    .filter((v) => typeof v === "string" && v.trim())
    .join(" ")
    .toLowerCase();
}

export function itemMatchesQuery(item, query) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const haystack = galleryItemSearchText(item);
  const tokens = q.split(/\s+/).filter(Boolean);
  return tokens.every((t) => haystack.includes(t));
}

export function buildSearchSuggestions(items, query, limit = 8) {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];

  const matches = items.filter((item) => itemMatchesQuery(item, q));
  const suggestions = [];

  for (const item of matches) {
    if (suggestions.length >= limit) break;
    suggestions.push({
      id: item.id,
      label: item.formatName,
      detail: item.captionPreview,
      query: item.formatName,
    });
  }

  const keywords = [
    "grading",
    "sub",
    "monday",
    "lesson plan",
    "parent email",
    "group work",
    "copier",
    "bell",
    "IEP",
    "homework",
  ];
  for (const kw of keywords) {
    if (suggestions.length >= limit) break;
    if (!kw.includes(q) && !q.includes(kw.split(" ")[0])) continue;
    if (suggestions.some((s) => s.query === kw)) continue;
    if (!items.some((item) => itemMatchesQuery(item, kw))) continue;
    suggestions.push({
      id: `kw-${kw}`,
      label: kw,
      detail: "Suggested search",
      query: kw,
    });
  }

  return suggestions;
}
