// Formats that lean on recognizable franchise / celebrity IP.
// Still available in the full library and customize deep-links, but
// deprioritized in featured carousels (Meme of the Day, Hot memes).

export const IP_SENSITIVE_FORMAT_IDS = new Set([
  "surprised-pikachu",
  "mocking-spongebob",
  "spider-pointing",
  "anakin-padme",
  "squidward-window",
  "rickroll",
]);

export function isIpSensitiveFormat(formatId) {
  return formatId ? IP_SENSITIVE_FORMAT_IDS.has(formatId) : false;
}
