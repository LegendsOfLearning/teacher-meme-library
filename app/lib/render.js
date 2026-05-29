// Server-side meme renderer using sharp + SVG overlays.
//
// Fonts: see font-setup.js — must load BEFORE sharp so librsvg/fontconfig
// can find Impact + Comic Neue on Vercel (FONTCONFIG_FILE → /tmp).
//
// Internal font family names (TTF name table):
//   Impact.ttf          -> "Impact"
//   Anton-Regular.ttf   -> "Anton" (legacy fallback)
//   ComicNeue-Bold.ttf  -> "Comic Neue" (weight 700)
//
// ── Style keys ──
//   "caption": Impact, ALL CAPS, white fill, heavy black stroke.
//   "mocking": Impact + alternating mIxEd cAsE.
//   "sign":    Impact on the cardboard "Change my mind" sign.
//   "doge":    Comic Neue Bold, lowercase, colored fill + black stroke.

import "./font-setup.js";
import sharp from "sharp";
import path from "node:path";
import { promises as fs } from "node:fs";
import { ensureFontsInstalled } from "./font-setup.js";

export { ensureFontsInstalled };

// Must match internal TTF family names — librsvg/pango look up via fontconfig.
const IMPACT_FAMILY = "Impact";
const COMIC_FAMILY = "Comic Neue";

// Kept for back-compat with the rest of the renderer; now returns an
// empty <defs> because @font-face data: URLs do not work in librsvg
// 2.61 (the version sharp 0.34 bundles). Fonts are loaded by name
// via Core Text / fontconfig from the OS user-fonts dir.
async function getFontStyle() {
  return "<defs></defs>";
}

// Per-font measured average glyph width (em fraction). Used by our
// greedy line-wrap to pick the right size before librsvg ever sees
// the SVG. Anton's letters average ~0.50em over A-Z, but caption
// lines that load up on wide glyphs (M, W, O, G, D, R) measure
// closer to 0.67em — and our worst-case is the worst line in any
// caption. Erring slightly wide here prevents Anton wide-glyph
// lines like "SMOOTH MORNING" from clipping past the zone's right
// edge at the chosen font size.
// Default corner; renderer picks br → bl → tr → tl based on caption collision.
export const BRAND_WATERMARK_CORNER = "br";

export const WATERMARK_CORNER_PRIORITY = ["br", "bl", "tr", "tl"];
const LOGO_SCALE_STEPS = [1, 0.88, 0.76, 0.64, 0.55, 0.48];

// Clearance between caption ink (incl. stroke) and the logo+pill.
const WATERMARK_CLEARANCE_PX = 56;
// Bbox width estimate for collision checks — wider than fitText uses so
// we never under-estimate and let glyphs spill into the brand mark.
const BBOX_CHAR_WIDTH = 0.72;
const BBOX_CHAR_WIDTH_MOCKING = 0.78;
const BBOX_SAFETY_FACTOR = 1.12;

function rectsOverlapPx(a, b) {
  return (
    a.left < b.right &&
    a.right > b.left &&
    a.top < b.bottom &&
    a.bottom > b.top
  );
}

function overlapAreaPx(a, b) {
  const left = Math.max(a.left, b.left);
  const right = Math.min(a.right, b.right);
  const top = Math.max(a.top, b.top);
  const bottom = Math.min(a.bottom, b.bottom);
  if (left >= right || top >= bottom) return 0;
  return (right - left) * (bottom - top);
}

/** Target logo width; scales down when corners are crowded. */
export function computeLogoTargetWidth(imgW, scale = 1) {
  const base = Math.max(120, Math.min(180, Math.round(imgW * 0.14)));
  const floor = Math.max(88, Math.round(imgW * 0.085));
  return Math.max(floor, Math.round(base * scale));
}

function zoneToObstacleRect(zone, imgW, imgH, padPx = 16) {
  const y0 = zone.y * imgH;
  const y1 = (zone.y + zone.h) * imgH;
  const isBottom = zone.y + zone.h > 0.68;
  const isTop = zone.y + zone.h < 0.28;

  // Impact-style top/bottom bands span the full width on real memes.
  if (isBottom) {
    return {
      left: 0,
      top: Math.max(0, y0 - padPx * 2),
      right: imgW,
      bottom: imgH,
    };
  }
  if (isTop) {
    return {
      left: 0,
      top: 0,
      right: imgW,
      bottom: Math.min(imgH, y1 + padPx * 3),
    };
  }
  return {
    left: zone.x * imgW - padPx,
    top: y0 - padPx,
    right: (zone.x + zone.w) * imgW + padPx,
    bottom: y1 + padPx,
  };
}

/** AI gallery PNGs bake full-width caption strips into the pixels. */
function galleryArtObstacleRects(format, imgW, imgH) {
  const src = format.file || "";
  if (!src.includes("/gallery/")) return [];
  return [
    { left: 0, top: imgH * 0.64, right: imgW, bottom: imgH },
    { left: 0, top: 0, right: imgW, bottom: imgH * 0.24 },
  ];
}

function expandObstacleRect(rect, padPx) {
  return {
    left: rect.left - padPx,
    top: rect.top - padPx,
    right: rect.right + padPx,
    bottom: rect.bottom + padPx,
  };
}

function bakedObstacleRects(format, imgW, imgH) {
  const rects = [];
  for (const b of format.bakedObstacles || []) {
    rects.push({
      left: b.x * imgW,
      top: b.y * imgH,
      right: (b.x + b.w) * imgW,
      bottom: (b.y + b.h) * imgH,
    });
  }
  return rects;
}

function cornerPriority(format) {
  const preferred = format.watermarkCorner || BRAND_WATERMARK_CORNER;
  return [
    preferred,
    ...WATERMARK_CORNER_PRIORITY.filter((c) => c !== preferred),
  ];
}

function scorePlacement(reserve, obstacles) {
  let area = 0;
  let hits = 0;
  for (const obs of obstacles) {
    const a = overlapAreaPx(reserve, obs);
    if (a > 0) {
      area += a;
      hits++;
    }
  }
  return hits * 1e9 + area;
}

function collectStaticObstacles(format, imgW, imgH) {
  const obstacles = [
    ...bakedObstacleRects(format, imgW, imgH),
    ...galleryArtObstacleRects(format, imgW, imgH),
  ];
  for (const zone of format.zones || []) {
    if (zone.decorative) continue;
    obstacles.push(zoneToObstacleRect(zone, imgW, imgH, 16));
  }
  return obstacles;
}

/** Bottom/top caption bands occupy the lower/upper corners — never put logo there. */
function cornersAllowedForObstacles(obstacles, imgW, imgH, preferredOrder) {
  const wide = (o) => o.right - o.left >= imgW * 0.65;
  const bottomBand = obstacles.some(
    (o) => wide(o) && o.bottom >= imgH * 0.88
  );
  const topBand = obstacles.some((o) => wide(o) && o.top <= imgH * 0.12);

  let allowed = [...preferredOrder];
  if (bottomBand) {
    allowed = allowed.filter((c) => c !== "br" && c !== "bl");
  }
  if (topBand) {
    allowed = allowed.filter((c) => c !== "tr" && c !== "tl");
  }
  if (allowed.length === 0) {
    allowed = bottomBand
      ? ["tr", "tl"]
      : topBand
        ? ["br", "bl"]
        : [...WATERMARK_CORNER_PRIORITY];
  }
  return allowed;
}

function layoutCaptionBboxes(format, captions, size, watermark) {
  const bboxes = [];
  for (const zone of format.zones || []) {
    if (zone.decorative) continue;
    const text = captions?.[zone.key];
    if (text == null || !String(text).trim()) continue;
    const { bbox } = renderZone(
      zone,
      text,
      size.width,
      size.height,
      watermark
    );
    if (bbox) bboxes.push(expandObstacleRect(bbox, 24));
  }
  return bboxes;
}

/** Pixel bbox of logo + dark pill + safety margin. */
export function computeBrandReservePx(
  corner,
  imgW,
  imgH,
  logoW,
  logoH,
  margin,
  pillPadX,
  pillPadY
) {
  const pillW = logoW + pillPadX * 2;
  const pillH = logoH + pillPadY * 2;
  const pad = WATERMARK_CLEARANCE_PX;
  switch (corner) {
    case "br":
      return {
        left: imgW - margin - pillW - pad,
        top: imgH - margin - pillH - pad,
        right: imgW,
        bottom: imgH,
      };
    case "bl":
      return {
        left: 0,
        top: imgH - margin - pillH - pad,
        right: margin + pillW + pad,
        bottom: imgH,
      };
    case "tr":
      return {
        left: imgW - margin - pillW - pad,
        top: 0,
        right: imgW,
        bottom: margin + pillH + pad,
      };
    default:
      return {
        left: 0,
        top: 0,
        right: margin + pillW + pad,
        bottom: margin + pillH + pad,
      };
  }
}

/** Shrink a caption box so its rectangle does not overlap the brand reserve. */
function applyReserveToZone(box, reserve, corner = BRAND_WATERMARK_CORNER) {
  if (!reserve) return box;
  let { x, y, w, h } = box;

  // Bottom-corner logos: shrink bottom bands away from the brand footprint.
  if (box.isBottomBand && (corner === "br" || corner === "bl")) {
    if (corner === "br" && x + w > reserve.left) {
      w = Math.max(56, reserve.left - x);
    }
    if (corner === "bl" && x < reserve.right) {
      const nx = reserve.right;
      w = Math.max(56, x + w - nx);
      x = nx;
    }
    if (y + h > reserve.top) h = Math.max(36, reserve.top - y);
  }

  if (!rectsOverlapPx({ x, y, w, h }, reserve)) return { x, y, w, h };

  if (reserve.right >= x + w - 0.5) {
    w = Math.max(56, reserve.left - x);
  }
  if (reserve.left <= x + 0.5) {
    const nx = reserve.right;
    w = Math.max(56, x + w - nx);
    x = nx;
  }
  if (reserve.bottom >= y + h - 0.5) {
    h = Math.max(36, reserve.top - y);
  }
  if (reserve.top <= y + 0.5) {
    const ny = reserve.bottom;
    h = Math.max(36, y + h - ny);
    y = ny;
  }
  return { x, y, w, h };
}

/** Nudge layout so measured ink stays outside the brand reserve. */
function fitCaptionAwayFromReserve({
  reserve,
  corner,
  zone,
  text,
  x,
  y,
  w,
  h,
  align,
  tx,
  fs,
  lines,
  lineHeight,
  strokeWidth,
  strokeRatio,
  family,
}) {
  let blockTop = y + (h - lines.length * lineHeight) / 2;
  const isBottomBand = zone.y + zone.h > 0.68;
  if (isBottomBand && reserve && (corner === "br" || corner === "bl")) {
    blockTop = y + Math.max(4, fs * 0.12);
  }

  let curTx = tx;
  let curFs = fs;
  let curLines = lines;
  let curLh = lineHeight;
  let curStroke = strokeWidth;

  for (let n = 0; n < 32; n++) {
    const totalH = curLines.length * curLh;
    if (
      isBottomBand &&
      reserve &&
      (corner === "br" || corner === "bl") &&
      blockTop + totalH + curStroke > reserve.top
    ) {
      blockTop = Math.max(y, reserve.top - totalH - curStroke - 4);
    }

    const bbox = measureCaptionBBox({
      align,
      tx: curTx,
      x,
      w,
      blockTop,
      totalH,
      fs: curFs,
      lines: curLines,
      lineHeight: curLh,
      strokeWidth: curStroke,
      family,
      wideGlyphs: zone.style === "mocking",
    });

    if (!reserve || !rectsOverlapPx(bbox, reserve)) {
      return {
        tx: curTx,
        fs: curFs,
        lines: curLines,
        lineHeight: curLh,
        strokeWidth: curStroke,
        blockTop,
        firstBaseline: blockTop + curFs * 0.92,
      };
    }

    if (corner === "br") {
      const maxRight = reserve.left - WATERMARK_CLEARANCE_PX;
      if (align === "center") {
        const overflow = bbox.right - maxRight;
        if (overflow > 0) curTx -= overflow;
      } else if (align === "right" && bbox.right > maxRight) {
        curTx -= bbox.right - maxRight;
      }
      if (bbox.bottom > reserve.top - WATERMARK_CLEARANCE_PX) {
        const lift =
          bbox.bottom - (reserve.top - WATERMARK_CLEARANCE_PX);
        blockTop = Math.max(y, blockTop - lift);
      }
    } else if (corner === "bl" && align === "center") {
      const overflow =
        reserve.right + WATERMARK_CLEARANCE_PX - bbox.left;
      if (overflow > 0) curTx += overflow;
    }

    const shrinkFloor = zone.minFontSize ?? 40;
    if (curFs <= shrinkFloor) {
      return {
        tx: curTx,
        fs: curFs,
        lines: curLines,
        lineHeight: curLh,
        strokeWidth: curStroke,
        blockTop,
        firstBaseline: blockTop + curFs * 0.92,
      };
    }
    curFs = Math.max(shrinkFloor, Math.floor(curFs * 0.92));
    curLh = curFs;
    const refit = fitText(text, w, h, zone.maxLines || 3, family, curFs);
    curLines = refit.lines;
    curLh = refit.lineHeight;
    curStroke =
      strokeRatio > 0
        ? Math.min(22, Math.max(4, curFs * strokeRatio))
        : 0;
    blockTop = y + (h - curLines.length * curLh) / 2;
    if (isBottomBand && (corner === "br" || corner === "bl")) {
      blockTop = y + Math.max(4, curFs * 0.12);
    }
  }

  const totalH = curLines.length * curLh;
  return enforceCaptionClearOfReserve({
    reserve,
    corner,
    zone,
    text,
    x,
    y,
    w,
    h,
    align,
    tx: curTx,
    fs: curFs,
    lines: curLines,
    lineHeight: curLh,
    strokeWidth: curStroke,
    strokeRatio,
    family,
    blockTop,
    firstBaseline: blockTop + curFs * 0.92,
  });
}

/** Final pass: shrink / shift until measured ink clears the brand reserve. */
function enforceCaptionClearOfReserve(ctx) {
  let {
    reserve,
    corner,
    zone,
    text,
    x,
    y,
    w,
    h,
    align,
    tx,
    fs,
    lines,
    lineHeight,
    strokeWidth,
    strokeRatio,
    family,
    blockTop,
  } = ctx;

  for (let pass = 0; pass < 48; pass++) {
    const totalH = lines.length * lineHeight;
    const bbox = measureCaptionBBox({
      align,
      tx,
      x,
      w,
      blockTop,
      totalH,
      fs,
      lines,
      lineHeight,
      strokeWidth,
      family,
      wideGlyphs: zone.style === "mocking",
    });
    if (!reserve || !rectsOverlapPx(bbox, reserve)) {
      return {
        tx,
        fs,
        lines,
        lineHeight,
        strokeWidth,
        blockTop,
        firstBaseline: blockTop + fs * 0.92,
      };
    }
    if (corner === "br") {
      const maxRight = reserve.left - WATERMARK_CLEARANCE_PX;
      if (bbox.right > maxRight) tx -= bbox.right - maxRight;
      if (bbox.bottom > reserve.top - WATERMARK_CLEARANCE_PX) {
        blockTop -= bbox.bottom - (reserve.top - WATERMARK_CLEARANCE_PX);
        blockTop = Math.max(y, blockTop);
      }
    } else if (corner === "bl") {
      const minLeft = reserve.right + WATERMARK_CLEARANCE_PX;
      if (bbox.left < minLeft) tx += minLeft - bbox.left;
      if (bbox.bottom > reserve.top - WATERMARK_CLEARANCE_PX) {
        blockTop -= bbox.bottom - (reserve.top - WATERMARK_CLEARANCE_PX);
        blockTop = Math.max(y, blockTop);
      }
    }
    const floorFs = zone.minFontSize ?? (zone.style === "caption" ? 40 : 32);
    fs = Math.max(floorFs, fs - 2);
    lineHeight = fs;
    const refit = fitText(text, w, h, zone.maxLines || 3, family, fs);
    lines = refit.lines;
    lineHeight = refit.lineHeight;
    strokeWidth =
      strokeRatio > 0
        ? Math.min(22, Math.max(4, fs * strokeRatio))
        : 0;
    const isBottomBand = zone.y + zone.h > 0.68;
    blockTop = y + (h - lines.length * lineHeight) / 2;
    if (isBottomBand && (corner === "br" || corner === "bl")) {
      blockTop = y + Math.max(4, fs * 0.12);
    }
  }

  return {
    tx,
    fs,
    lines,
    lineHeight,
    strokeWidth,
    blockTop,
    firstBaseline: blockTop + fs * 0.92,
  };
}

export function measureCaptionBBox({
  align,
  tx,
  x,
  w,
  blockTop,
  totalH,
  fs,
  lines,
  lineHeight,
  strokeWidth,
  family,
  wideGlyphs,
}) {
  const charW = fs * (wideGlyphs ? BBOX_CHAR_WIDTH_MOCKING : BBOX_CHAR_WIDTH);
  const lineWidths = lines.map((l) => l.length * charW);
  const textW = Math.max(...lineWidths, 1) * BBOX_SAFETY_FACTOR;
  let left;
  let right;
  if (align === "center") {
    left = tx - textW / 2;
    right = tx + textW / 2;
  } else if (align === "right") {
    right = tx;
    left = tx - textW;
  } else {
    left = tx;
    right = tx + textW;
  }
  const sw = strokeWidth || 0;
  return {
    left: left - sw,
    right: right + sw,
    top: blockTop - sw,
    bottom: blockTop + totalH + sw,
  };
}

/** Pad PNG to 1:1 with centered letterbox (black bars). */
export async function padPngToSquare(pngBuf) {
  const meta = await sharp(pngBuf).metadata();
  const side = Math.max(meta.width, meta.height);
  return sharp({
    create: {
      width: side,
      height: side,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 1 },
    },
  })
    .composite([
      {
        input: pngBuf,
        top: Math.floor((side - meta.height) / 2),
        left: Math.floor((side - meta.width) / 2),
      },
    ])
    .png({ compressionLevel: 9, quality: 92 })
    .toBuffer();
}

function avgCharWidth(family) {
  if (family === COMIC_FAMILY) return 0.55;
  if (family === IMPACT_FAMILY) return 0.62;
  return 0.55;
}

function escXml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Curly quotes etc. often lack glyphs in bundled meme fonts on Linux. */
function normalizeCaptionText(s) {
  return String(s)
    .replace(/[\u2018\u2019\u2032]/g, "'")
    .replace(/[\u201C\u201D\u2033]/g, '"')
    .replace(/[\u2013\u2014]/g, "-");
}

// Alternate caps starting lowercase, leaving non-letters alone.
function toMockingCase(text) {
  let out = "";
  let i = 0;
  for (const ch of text) {
    if (/[A-Za-z]/.test(ch)) {
      out += i % 2 === 0 ? ch.toLowerCase() : ch.toUpperCase();
      i++;
    } else {
      out += ch;
    }
  }
  return out;
}

// Greedy fallback wrapper, kept for the (rare) case where no balanced
// split is feasible at any font size. The renderer's main path is
// `balancedSplit` below.
function wrapText(text, maxWidth, fontSize, family) {
  const w = avgCharWidth(family) * fontSize;
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && candidate.length * w > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines.length > 0 ? lines : [""];
}

// Split `words` into exactly `k` contiguous, non-empty lines so that
// the WIDEST line is as narrow as possible (minimax balancing). DP:
// `dp[i][j]` = best max-line-chars when first `i` words are split
// into `j` lines. O(n^2 * k); n is small (caption-sized).
//
// Returns `{ lines: string[], maxChars: number }` or null if `k` is
// infeasible (e.g. more lines than words).
function balancedSplit(words, k) {
  const n = words.length;
  if (n === 0 || k <= 0 || k > n) return null;

  // chars per line = sum(word lengths) + (numWords - 1) for spaces
  const lens = words.map((w) => w.length);
  const pref = [0];
  for (let i = 0; i < n; i++) pref.push(pref[i] + lens[i]);
  const lineChars = (s, e) => pref[e] - pref[s] + (e - s - 1);

  const INF = Infinity;
  // dp[i][j] = { maxC, splitAt } — splitAt is where line j starts.
  const dp = Array.from({ length: n + 1 }, () =>
    Array.from({ length: k + 1 }, () => null)
  );
  dp[0][0] = { maxC: 0, splitAt: -1 };

  for (let j = 1; j <= k; j++) {
    // Line j must consume at least 1 word, and leave at least k-j
    // words for the remaining lines.
    for (let i = j; i <= n - (k - j); i++) {
      let best = null;
      for (let s = j - 1; s <= i - 1; s++) {
        if (!dp[s][j - 1]) continue;
        const lw = lineChars(s, i);
        const maxC = Math.max(dp[s][j - 1].maxC, lw);
        if (!best || maxC < best.maxC) best = { maxC, splitAt: s };
      }
      dp[i][j] = best;
    }
  }
  if (!dp[n][k]) return null;

  const lines = [];
  let i = n,
    j = k;
  while (j > 0) {
    const s = dp[i][j].splitAt;
    lines.unshift(words.slice(s, i).join(" "));
    i = s;
    j--;
  }
  return { lines, maxChars: dp[n][k].maxC };
}

// Classic meme captions rarely fill the entire zone height — they sit
// around 40–50% of the band with breathing room. Without this cap,
// short custom text ("TESTTT") balloons to ~95% of zone height and
// the heavy stroke reads as a solid black slab covering the photo.
const MAX_LINE_FS_RATIO = 0.92;

// Choose font size + line layout. Tries every `k` in [1..maxLines],
// picks the smallest `k` whose font size is within 75% of the best,
// so we prefer FEWER LINES with a slightly smaller font over many
// short pyramid-shaped lines (which is what made wraps like
// "FINISHING / THE FULL / LESSON / PLAN" look amateurish — the
// inspiration captions always look balanced).
function fitText(text, maxWidth, maxHeight, maxLines, family, startSize) {
  const words = String(text).trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return { fs: 12, lines: [""], lineHeight: 12 };
  }

  const cap = Math.max(14, Math.floor(startSize));
  const charPerFs = avgCharWidth(family);
  const charCount = words.join(" ").length;

  const candidates = [];
  const lim = Math.min(maxLines, words.length);
  for (let k = 1; k <= lim; k++) {
    const split = balancedSplit(words, k);
    if (!split) continue;

    const lineSlot = maxHeight / k;
    // Max fs constrained by widest line width AND per-line height.
    const widthFs = maxWidth / (split.maxChars * charPerFs);
    const heightFs = lineSlot * MAX_LINE_FS_RATIO;
    let fs = Math.floor(Math.min(widthFs, heightFs, cap));
    // Very short strings shouldn't scale to the width limit alone —
    // keep them closer to a "label" size so they don't dominate the
    // frame (Hide the Pain Harold customize was the main offender).
    if (charCount <= 6 && k === 1) {
      fs = Math.floor(Math.min(fs, lineSlot * 0.38, widthFs * 0.55));
    }
    if (fs < 36) continue;
    candidates.push({ fs, lines: split.lines, k });
  }

  if (candidates.length === 0) {
    const floorFs = Math.max(40, Math.floor(Math.min(maxWidth, maxHeight) * 0.28));
    return {
      fs: floorFs,
      lines: wrapText(text, maxWidth, floorFs, family),
      lineHeight: floorFs,
    };
  }

  // Prefer the largest readable font; tie-break toward fewer lines.
  candidates.sort((a, b) => b.fs - a.fs || a.k - b.k);
  const chosen = candidates[0];

  return { fs: chosen.fs, lines: chosen.lines, lineHeight: chosen.fs };
}

function resolveZoneStyle(zone) {
  switch (zone.style) {
    case "mocking":
      return {
        family: IMPACT_FAMILY,
        transform: toMockingCase,
        fill: "#ffffff",
        stroke: "#000000",
        strokeRatio: 0.28,
      };
    case "sign":
      return {
        family: IMPACT_FAMILY,
        transform: (s) => s.toUpperCase(),
        fill: "#1a1a1a",
        stroke: "none",
        strokeRatio: 0,
      };
    case "doge":
      return {
        family: COMIC_FAMILY,
        weight: 700,
        transform: (s) => s.toLowerCase(),
        fill: zone.color || "#ff3b3b",
        stroke: "#000000",
        strokeRatio: 0.06,
      };
    case "dark-on-light":
      return {
        family: IMPACT_FAMILY,
        transform: (s) => s.toUpperCase(),
        fill: "#000000",
        stroke: "none",
        strokeRatio: 0,
      };
    case "caption":
    default:
      // Impact white-fill + heavy black stroke on photo / black bands.
      //
      // Stroke ratio 0.28 with paint-order=stroke fill gives a visible
      // outline of ~14% of font size. That's higher than the canonical
      // ~10% you see on imgflip renders, but at the resolutions the
      // gallery thumbnails get downscaled to (1536px -> ~250px wide,
      // a 6x reduction), a 10% stroke shrinks to 1-2 visible pixels
      // and reads as "thin". The bumped ratio keeps the chunky
      // AI-baked feel even after thumbnailing.
      return {
        family: IMPACT_FAMILY,
        transform: (s) => s.toUpperCase(),
        fill: "#ffffff",
        stroke: "#000000",
        strokeRatio: 0.28,
      };
  }
}

// Minimum render width. Templates ship at varying native resolutions
// (Crying Cat is 300×300, Drake is 1200×1200). Rendering each at its
// native size makes the small ones look thin and amateurish compared
// to the curated gallery — Impact font weight reads better with more
// pixels. We always upscale to at least OUTPUT_MIN_WIDTH so every
// finished meme has the same chunky, heavy-stroke look you see in
// viral teacher memes regardless of source template size.
const OUTPUT_MIN_WIDTH = 1200;

export function getRenderSize(format) {
  if (format.width >= OUTPUT_MIN_WIDTH) {
    return { width: format.width, height: format.height };
  }
  const scale = OUTPUT_MIN_WIDTH / format.width;
  return {
    width: OUTPUT_MIN_WIDTH,
    height: Math.round(format.height * scale),
  };
}

function measureZoneFs(zone, rawText, imgW, imgH) {
  if (rawText == null || String(rawText).trim() === "") return null;
  const style = resolveZoneStyle(zone);
  const text = style.transform(normalizeCaptionText(String(rawText).trim()));
  const w = zone.w * imgW;
  const h = zone.h * imgH;
  const naturalStart = Math.min(h * 0.95, w * 0.42);
  const zoneMaxFs = zone.maxFontSize ?? Math.floor(h * 0.78);
  const zoneMinFs =
    zone.minFontSize ??
    (zone.style === "doge"
      ? 44
      : zone.style === "sign"
        ? 50
        : zone.style === "caption"
          ? 52
          : 0);
  const startSize = Math.max(zoneMinFs || 0, Math.min(naturalStart, zoneMaxFs));
  let { fs } = fitText(
    text,
    w,
    h,
    zone.maxLines ?? 2,
    style.family,
    startSize
  );
  if (zoneMinFs > 0 && fs < zoneMinFs) {
    const retry = fitText(
      text,
      w,
      h,
      zone.maxLines ?? 2,
      style.family,
      Math.max(zoneMinFs, zoneMaxFs, startSize)
    );
    fs = retry.fs >= zoneMinFs ? retry.fs : zoneMinFs;
  }
  return fs;
}

function computeSyncSizeCaps(format, captions, imgW, imgH) {
  const groups = new Map();
  for (const zone of format.zones) {
    if (!zone.syncSizeGroup || zone.decorative) continue;
    const raw = captions?.[zone.key];
    if (raw == null || !String(raw).trim()) continue;
    if (!groups.has(zone.syncSizeGroup)) groups.set(zone.syncSizeGroup, []);
    groups.get(zone.syncSizeGroup).push(zone);
  }
  const caps = new Map();
  for (const [, zones] of groups) {
    if (zones.length < 2) continue;
    let minFs = Infinity;
    for (const zone of zones) {
      const fs = measureZoneFs(zone, captions[zone.key], imgW, imgH);
      if (fs != null) minFs = Math.min(minFs, fs);
    }
    if (!Number.isFinite(minFs)) continue;
    for (const zone of zones) caps.set(zone.key, minFs);
  }
  return caps;
}

function renderZone(zone, rawText, imgW, imgH, watermark, syncCapFs, coverBaked) {
  if (rawText == null || String(rawText).trim() === "") {
    return { fragment: "", bbox: null };
  }
  let style = resolveZoneStyle(zone);
  if (coverBaked && style.strokeRatio > 0) {
    style = {
      ...style,
      strokeRatio: Math.min(0.42, style.strokeRatio * 1.55),
    };
  }
  const text = style.transform(normalizeCaptionText(String(rawText).trim()));

  let x = zone.x * imgW;
  let y = zone.y * imgH;
  let w = zone.w * imgW;
  let h = zone.h * imgH;

  const isBottomBand = zone.y + zone.h > 0.62;
  if (watermark?.reservePx) {
    ({ x, y, w, h } = applyReserveToZone(
      { x, y, w, h, isBottomBand },
      watermark.reservePx,
      watermark.corner
    ));
  }

  const naturalStart = Math.min(h * 0.95, w * 0.42);
  let zoneMaxFs = zone.maxFontSize ?? Math.floor(h * 0.78);
  const zoneMinFs =
    zone.minFontSize ??
    (zone.style === "doge"
      ? 44
      : zone.style === "sign"
        ? 50
        : zone.style === "caption"
          ? 52
          : 0);
  let startSize = Math.max(zoneMinFs || 0, Math.min(naturalStart, zoneMaxFs));
  if (syncCapFs != null) {
    startSize = Math.min(startSize, syncCapFs);
  }

  let { fs, lines, lineHeight } = fitText(
    text,
    w,
    h,
    zone.maxLines ?? 2,
    style.family,
    startSize
  );

  if (zoneMinFs > 0 && fs < zoneMinFs) {
    const retry = fitText(
      text,
      w,
      h,
      zone.maxLines ?? 2,
      style.family,
      Math.max(zoneMinFs, zoneMaxFs, startSize)
    );
    if (retry.fs >= zoneMinFs) {
      ({ fs, lines, lineHeight } = retry);
    } else {
      fs = zoneMinFs;
      lines = wrapText(text, w, zoneMinFs, style.family).slice(
        0,
        zone.maxLines ?? 3
      );
      lineHeight = zoneMinFs;
    }
  }

  if (syncCapFs != null && fs > syncCapFs) {
    const capped = fitText(
      text,
      w,
      h,
      zone.maxLines ?? 2,
      style.family,
      syncCapFs
    );
    fs = Math.min(capped.fs, syncCapFs);
    lines = capped.lines;
    lineHeight = capped.fs;
  }

  const align = zone.align || "center";
  let anchor = "middle";
  let tx = x + w / 2;
  if (align === "left") {
    anchor = "start";
    tx = x;
  } else if (align === "right") {
    anchor = "end";
    tx = x + w;
  }

  const strokeWidth =
    style.strokeRatio > 0
      ? Math.min(22, Math.max(4, fs * style.strokeRatio))
      : 0;

  const laid = fitCaptionAwayFromReserve({
    reserve: watermark?.reservePx,
    corner: watermark?.corner,
    zone,
    text,
    x,
    y,
    w,
    h,
    align,
    tx,
    fs,
    lines,
    lineHeight,
    strokeWidth,
    strokeRatio: style.strokeRatio,
    family: style.family,
  });
  fs = laid.fs;
  lines = laid.lines;
  lineHeight = laid.lineHeight;
  tx = laid.tx;
  const blockTop = laid.blockTop;
  const firstBaseline = laid.firstBaseline;
  const strokeWidthFinal = laid.strokeWidth;

  const textEls = lines
    .map((line, i) => {
      const ly = firstBaseline + i * lineHeight;
      const strokeAttrs =
        strokeWidthFinal > 0
          ? ` stroke="${style.stroke}" stroke-width="${strokeWidthFinal.toFixed(
              2
            )}" stroke-linejoin="round" paint-order="stroke fill"`
          : "";
      const weightAttr = style.weight ? ` font-weight="${style.weight}"` : "";
      return `<text x="${tx.toFixed(2)}" y="${ly.toFixed(
        2
      )}" font-family="${style.family}" font-size="${fs.toFixed(
        2
      )}" fill="${style.fill}"${weightAttr}${strokeAttrs} text-anchor="${anchor}">${escXml(line)}</text>`;
    })
    .join("\n");

  let fragment = textEls;
  if (coverBaked && lines.some((l) => l.trim()) && !zone.maskTight) {
    const zoneMask = `<rect x="${x.toFixed(2)}" y="${y.toFixed(
      2
    )}" width="${w.toFixed(2)}" height="${h.toFixed(2)}" fill="#000000"/>`;
    fragment = `${zoneMask}\n${fragment}`;
  }
  if (coverBaked && strokeWidthFinal > 0) {
    const knockout = lines
      .map((line, i) => {
        const ly = firstBaseline + i * lineHeight;
        const kStroke = Math.min(48, strokeWidthFinal * 2.4);
        return `<text x="${tx.toFixed(2)}" y="${ly.toFixed(
          2
        )}" font-family="${style.family}" font-size="${fs.toFixed(
          2
        )}" fill="#000000" stroke="#000000" stroke-width="${kStroke.toFixed(
          2
        )}" stroke-linejoin="round" paint-order="stroke fill" text-anchor="${anchor}">${escXml(line)}</text>`;
      })
      .join("\n");
    fragment = `${knockout}\n${textEls}`;
  }

  // Tight mask: only covers the caption glyphs (+ small pad), not the
  // full zone band. Used on AI gallery sources that still have baked-in
  // text when no blank `renderFile` template exists yet.
  if (zone.maskTight && lines.some((l) => l.trim())) {
    const padX = fs * 0.22;
    const padY = fs * 0.14;
    const maxLineLen = Math.max(...lines.map((l) => l.length));
    const textBlockW = maxLineLen * fs * avgCharWidth(style.family);
    const boxW = Math.min(w, textBlockW + padX * 2);
    const boxH = lines.length * lineHeight + padY * 2;
    let boxX;
    if (align === "center") boxX = tx - boxW / 2;
    else if (align === "left") boxX = x;
    else boxX = x + w - boxW;
    const boxY = blockTop - padY;
    const fill = zone.maskFill || "rgba(0,0,0,0.78)";
    const rx = Math.min(fs * 0.12, boxH / 4);
    const mask = `<rect x="${boxX.toFixed(2)}" y="${boxY.toFixed(
      2
    )}" width="${boxW.toFixed(2)}" height="${boxH.toFixed(
      2
    )}" rx="${rx.toFixed(2)}" fill="${fill}"/>`;
    const bbox = measureCaptionBBox({
      align,
      tx,
      x,
      w,
      blockTop,
      totalH: lines.length * lineHeight,
      fs,
      lines,
      lineHeight,
      strokeWidth: strokeWidthFinal,
      family: style.family,
      wideGlyphs: zone.style === "mocking",
    });
    return { fragment: `${mask}\n${fragment}`, bbox };
  }

  const bbox = measureCaptionBBox({
    align,
    tx,
    x,
    w,
    blockTop,
    totalH: lines.length * lineHeight,
    fs,
    lines,
    lineHeight,
    strokeWidth: strokeWidthFinal,
    family: style.family,
    wideGlyphs: zone.style === "mocking",
  });
  return { fragment, bbox };
}

async function buildSvgOverlay(format, captions, watermark, size, coverBaked = false) {
  const W = size.width;
  const H = size.height;
  const fontStyle = await getFontStyle();
  const parts = [];
  const syncCaps = computeSyncSizeCaps(format, captions, W, H);
  // First pass: explicit per-zone masks declared on the format
  // (decorative covers, trade-offer white boxes, etc.).
  for (const zone of format.zones) {
    if (!zone.maskFill || zone.maskTight) continue;
    const hasCaption =
      captions?.[zone.key] != null &&
      String(captions[zone.key]).trim() !== "";
    if (!zone.decorative && !hasCaption) continue;
    const rx = (zone.x * W).toFixed(2);
    const ry = (zone.y * H).toFixed(2);
    const rw = (zone.w * W).toFixed(2);
    const rh = (zone.h * H).toFixed(2);
    parts.push(
      `<rect x="${rx}" y="${ry}" width="${rw}" height="${rh}" fill="${zone.maskFill}"/>`
    );
  }
  for (const zone of format.zones) {
    if (zone.decorative) continue;
    const rendered = renderZone(
      zone,
      captions?.[zone.key],
      W,
      H,
      watermark,
      syncCaps.get(zone.key),
      coverBaked
    );
    if (rendered?.fragment) parts.push(rendered.fragment);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
${fontStyle}
${parts.join("\n")}
</svg>`;
}

function attachWatermarkPixelCoords(plan, size) {
  const { corner, logoMeta, margin, pillPadX, pillPadY } = plan;
  const pillW = logoMeta.width + pillPadX * 2;
  const pillH = logoMeta.height + pillPadY * 2;
  let pillLeft;
  let pillTop;
  if (corner === "br") {
    pillLeft = size.width - pillW - margin;
    pillTop = size.height - pillH - margin;
  } else if (corner === "bl") {
    pillLeft = margin;
    pillTop = size.height - pillH - margin;
  } else if (corner === "tr") {
    pillLeft = size.width - pillW - margin;
    pillTop = margin;
  } else {
    pillLeft = margin;
    pillTop = margin;
  }
  return {
    ...plan,
    pillW,
    pillH,
    pillLeft,
    pillTop,
    logoLeftPx: pillLeft + pillPadX,
    logoTopPx: pillTop + pillPadY,
  };
}

/**
 * Pick watermark corner + scale so the logo never overlaps caption ink,
 * zone boxes, or format `bakedObstacles` (AI-baked punchlines on templates).
 */
export async function resolveWatermarkPlacement(format, captions, size) {
  const W = size.width;
  const H = size.height;
  const staticObstacles = collectStaticObstacles(format, W, H);
  const preferred = cornerPriority(format);
  let best = null;

  for (const logoScale of LOGO_SCALE_STEPS) {
    const logoTargetW = computeLogoTargetWidth(W, logoScale);
    const logoBuf = await loadLogoBuffer(logoTargetW);
    const logoMeta = await sharp(logoBuf).metadata();
    const margin = Math.max(12, Math.round(W * 0.02));
    const pillPadX = Math.round(logoMeta.width * 0.16);
    const pillPadY = Math.round(logoMeta.height * 0.32);

    const corners = cornersAllowedForObstacles(
      staticObstacles,
      W,
      H,
      preferred
    );

    for (const corner of corners) {
      const reservePx = computeBrandReservePx(
        corner,
        W,
        H,
        logoMeta.width,
        logoMeta.height,
        margin,
        pillPadX,
        pillPadY
      );
      const watermark = { corner, reservePx };
      const captionBboxes = layoutCaptionBboxes(
        format,
        captions,
        size,
        watermark
      );

      let violations = 0;
      for (const bbox of captionBboxes) {
        if (captionInkOverlapsBrandReserve(bbox, reservePx)) violations++;
      }

      const score =
        scorePlacement(reservePx, [...staticObstacles, ...captionBboxes]) +
        violations * 5e9;

      const candidate = {
        corner,
        logoScale,
        logoBuf,
        logoMeta,
        margin,
        pillPadX,
        pillPadY,
        reservePx,
        score,
        violations,
      };

      if (violations === 0 && score === 0) {
        return attachWatermarkPixelCoords(candidate, size);
      }
      if (
        !best ||
        score < best.score ||
        (score === best.score && logoScale > best.logoScale)
      ) {
        best = candidate;
      }
    }
  }

  if (best && best.violations === 0 && best.score === 0) {
    return attachWatermarkPixelCoords(best, size);
  }

  // Hard fallback: top corner, smallest logo — never stack on bottom captions.
  const fallbackCorner = cornersAllowedForObstacles(
    staticObstacles,
    W,
    H,
    preferred
  ).includes("tr")
    ? "tr"
    : cornersAllowedForObstacles(staticObstacles, W, H, preferred)[0] ||
      "tr";
  const logoTargetW = computeLogoTargetWidth(W, 0.48);
  const logoBuf = await loadLogoBuffer(logoTargetW);
  const logoMeta = await sharp(logoBuf).metadata();
  const margin = Math.max(12, Math.round(W * 0.02));
  const pillPadX = Math.round(logoMeta.width * 0.16);
  const pillPadY = Math.round(logoMeta.height * 0.32);
  const reservePx = computeBrandReservePx(
    fallbackCorner,
    W,
    H,
    logoMeta.width,
    logoMeta.height,
    margin,
    pillPadX,
    pillPadY
  );
  return attachWatermarkPixelCoords(
    {
      corner: fallbackCorner,
      logoScale: 0.48,
      logoBuf,
      logoMeta,
      margin,
      pillPadX,
      pillPadY,
      reservePx,
      score: 0,
      violations: 0,
    },
    size
  );
}

/** Watermark layout shared by render + clearance audit. */
export async function buildWatermarkPlan(format, size, captions) {
  if (captions) {
    const plan = await resolveWatermarkPlacement(format, captions, size);
    return {
      corner: plan.corner,
      reservePx: plan.reservePx,
      logoScale: plan.logoScale,
    };
  }
  const logoTargetW = computeLogoTargetWidth(size.width, 1);
  const logoBuf = await loadLogoBuffer(logoTargetW);
  const logoMeta = await sharp(logoBuf).metadata();
  const margin = Math.max(12, Math.round(size.width * 0.02));
  const corner = format.watermarkCorner || BRAND_WATERMARK_CORNER;
  const pillPadX = Math.round(logoMeta.width * 0.16);
  const pillPadY = Math.round(logoMeta.height * 0.32);
  return {
    corner,
    reservePx: computeBrandReservePx(
      corner,
      size.width,
      size.height,
      logoMeta.width,
      logoMeta.height,
      margin,
      pillPadX,
      pillPadY
    ),
  };
}

/** Returns zones whose caption ink still overlaps the brand reserve. */
export async function auditMemeBrandClearance(format, captions) {
  const size = getRenderSize(format);
  const plan = await resolveWatermarkPlacement(format, captions, size);
  const violations = [];
  for (const zone of format.zones || []) {
    if (zone.decorative) continue;
    const text = captions?.[zone.key];
    if (text == null || !String(text).trim()) continue;
    const { bbox } = renderZone(zone, text, size.width, size.height, {
      corner: plan.corner,
      reservePx: plan.reservePx,
    });
    if (captionInkOverlapsBrandReserve(bbox, plan.reservePx)) {
      violations.push({
        formatId: format.id,
        zone: zone.key,
        text,
        corner: plan.corner,
      });
    }
  }
  return violations;
}

let cachedLogo = null;
async function loadLogoBuffer(targetWidth) {
  // We resize on every call so different formats can use different
  // widths; sharp's resize is fast enough that caching is unnecessary.
  const logoPath = path.join(
    process.cwd(),
    "public",
    "legends-logo-white.png"
  );
  return sharp(logoPath).resize(targetWidth).png().toBuffer();
}

/**
 * Render a meme for the given format + filled-in caption map.
 *
 * @param {object} format    A meme format from meme-formats.js.
 * @param {object} captions  Map of zone-key -> string. Missing keys
 *                           render as empty strings.
 * @returns {Promise<Buffer>} PNG buffer.
 */
// Gallery thumbnail → blank customize template. Keeps the curated
// gallery cat/art instead of swapping in a different imgflip JPEG.
export const GALLERY_RENDER_SOURCES = {
  "/gallery/disaster-girl-admin.png":
    "/templates-meme/disaster-girl-gallery-blank.png",
  "/gallery/grumpy-cat-plans.png":
    "/templates-meme/grumpy-cat-plans-blank.png",
  "/gallery/crying-cat-papers.png":
    "/templates-meme/crying-cat-gallery-papers.png",
  "/gallery/crying-cat-copier.png":
    "/templates-meme/crying-cat-gallery-copier.png",
  "/gallery/same-picture-group-work.png":
    "/templates-meme/pam-same-picture-gallery.png",
  "/gallery/same-picture-bell.png":
    "/templates-meme/pam-same-picture-gallery.png",
};

function isGalleryPath(filePath) {
  return typeof filePath === "string" && filePath.includes("/gallery/");
}

function defaultZoneMaskFill(zone) {
  if (zone.maskFill) return zone.maskFill;
  if (zone.style === "sign" || zone.style === "dark-on-light") {
    return "#ffffff";
  }
  return "#000000";
}

/** Erase rect for baked gallery captions (letterbox bars vs on-photo zones). */
function zoneEraseRect(zone, W, H, { letterbox = true, bandBounds = null } = {}) {
  const isTopBand = zone.y + zone.h <= 0.35;
  const isBottomBand = zone.y >= 0.65;
  if (zone.style === "sign" || zone.style === "dark-on-light") {
    return {
      x: zone.x * W,
      y: zone.y * H,
      w: zone.w * W,
      h: zone.h * H,
    };
  }
  if (!letterbox) {
    const padX = zone.w * 0.04;
    const padY = zone.h * 0.35;
    const x = Math.max(0, (zone.x - padX) * W);
    const y = Math.max(0, (zone.y - padY) * H);
    const w = Math.min(W - x, (zone.w + padX * 2) * W);
    const h = Math.min(H - y, (zone.h + padY * 2) * H);
    return { x, y, w, h };
  }
  if (bandBounds) {
    if (isTopBand) {
      const frac = Math.max(
        bandBounds.topEndFrac,
        Math.min(0.3, zone.y + zone.h + 0.06)
      );
      return { x: 0, y: 0, w: W, h: Math.round(H * frac) };
    }
    if (isBottomBand) {
      const yFrac = Math.min(
        bandBounds.bottomStartFrac,
        Math.max(zone.y - 0.04, 0.66)
      );
      const y = Math.round(H * yFrac);
      return { x: 0, y, w: W, h: H - y };
    }
  }
  if (isTopBand) {
    const frac = Math.min(0.18, zone.y + zone.h + 0.02);
    return { x: 0, y: 0, w: W, h: Math.round(H * frac) };
  }
  if (isBottomBand) {
    const y = Math.round(H * Math.max(zone.y - 0.02, 0.82));
    return { x: 0, y, w: W, h: H - y };
  }
  return {
    x: zone.x * W,
    y: zone.y * H,
    w: zone.w * W,
    h: zone.h * H,
  };
}

/** True when the gallery PNG uses black letterbox caption bars. */
async function galleryUsesLetterboxBands(imageBuf) {
  const { data, info } = await sharp(imageBuf)
    .raw()
    .toBuffer({ resolveWithObject: true });
  const W = info.width;
  const H = info.height;
  const bandRows = Math.max(12, Math.round(H * 0.08));
  const midRow = Math.round(H * 0.5);

  function rowMean(y) {
    let sum = 0;
    for (let x = 0; x < W; x++) {
      sum += data[(y * W + x) * info.channels];
    }
    return sum / W;
  }

  let topSum = 0;
  let midSum = 0;
  for (let y = 0; y < bandRows; y++) topSum += rowMean(y);
  for (let y = midRow - Math.floor(bandRows / 2); y < midRow + Math.ceil(bandRows / 2); y++) {
    midSum += rowMean(y);
  }
  const topMean = topSum / bandRows;
  const midMean = midSum / bandRows;
  return topMean < 25 && midMean > 55;
}

/** Pixel-scan black letterbox bars so erase stays off the photo. */
async function detectLetterboxBandBounds(imageBuf) {
  const { data, info } = await sharp(imageBuf)
    .raw()
    .toBuffer({ resolveWithObject: true });
  const W = info.width;
  const H = info.height;
  const DARK = 28;

  function rowMean(y) {
    let sum = 0;
    for (let x = 0; x < W; x++) {
      sum += data[(y * W + x) * info.channels];
    }
    return sum / W;
  }

  let topEnd = 0;
  for (let y = 0; y < H; y++) {
    if (rowMean(y) > DARK) {
      topEnd = y;
      break;
    }
  }

  let bottomStart = H;
  for (let y = H - 1; y >= 0; y--) {
    if (rowMean(y) > DARK) {
      bottomStart = y + 1;
      break;
    }
  }

  const pad = Math.max(8, Math.round(H * 0.012));
  return {
    topEndFrac: Math.min(0.22, (topEnd + pad) / H),
    bottomStartFrac: Math.max(0.78, (bottomStart - pad) / H),
  };
}

async function eraseBakedCaptionsFromBase(baseBuf, format, size, opts = {}) {
  const W = size.width;
  const H = size.height;
  const parts = [];
  for (const zone of format.zones) {
    if (zone.decorative) continue;
    const rect = zoneEraseRect(zone, W, H, opts);
    const fill = defaultZoneMaskFill(zone);
    parts.push(
      `<rect x="${rect.x.toFixed(2)}" y="${rect.y.toFixed(2)}" width="${rect.w.toFixed(2)}" height="${rect.h.toFixed(2)}" fill="${fill}"/>`
    );
  }
  if (!parts.length) return baseBuf;
  const svg = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${parts.join("")}</svg>`
  );
  return sharp(baseBuf).composite([{ input: svg, top: 0, left: 0 }]).toBuffer();
}

function resolveRenderSource(format, sourceFile) {
  if (sourceFile && GALLERY_RENDER_SOURCES[sourceFile]) {
    return GALLERY_RENDER_SOURCES[sourceFile];
  }
  if (sourceFile) return sourceFile;
  return format.renderFile || format.file;
}

function usesBlankGalleryTemplate(sourceFile) {
  return Boolean(sourceFile && GALLERY_RENDER_SOURCES[sourceFile]);
}

export async function renderMeme(format, captions, options = {}) {
  await ensureFontsInstalled();

  const sourcePath = resolveRenderSource(format, options.sourceFile);
  const templatePath = path.join(
    process.cwd(),
    "public",
    sourcePath.replace(/^\//, "")
  );

  const meta = await sharp(templatePath).metadata();
  // High-res gallery (or blank gallery-derived) templates keep their
  // native pixels so caption zones align with the art — not imgflip
  // dimensions that letterbox into black bars.
  const size =
    meta.width >= 1000
      ? { width: meta.width, height: meta.height }
      : getRenderSize(format);

  const eraseBakedCaptions =
    isGalleryPath(options.sourceFile) &&
    !usesBlankGalleryTemplate(options.sourceFile);

  const skipWatermark =
    format.skipWatermark === true || isGalleryPath(options.sourceFile);

  let baseBuf = await sharp(templatePath)
    .resize(size.width, size.height, { fit: "fill", kernel: "lanczos3" })
    .toBuffer();

  let coverBakedCaptions = false;
  if (eraseBakedCaptions) {
    const letterbox = await galleryUsesLetterboxBands(baseBuf);
    const bandBounds = letterbox
      ? await detectLetterboxBandBounds(baseBuf)
      : null;
    baseBuf = await eraseBakedCaptionsFromBase(baseBuf, format, size, {
      letterbox,
      bandBounds,
    });
    // Knockout stroke paints over any baked caption pixels that survive
    // the band erase (common when Impact strokes bleed into the photo).
    coverBakedCaptions = true;
  }

  const placement = skipWatermark
    ? null
    : await resolveWatermarkPlacement(format, captions, size);

  const watermark = placement
    ? { corner: placement.corner, reservePx: placement.reservePx }
    : null;

  const svg = await buildSvgOverlay(
    format,
    captions,
    watermark,
    size,
    coverBakedCaptions
  );

  const composites = [{ input: Buffer.from(svg), top: 0, left: 0 }];
  if (placement) {
    const { logoBuf, pillW, pillH, pillLeft, pillTop, logoLeftPx, logoTopPx } =
      placement;
    const radius = Math.round(pillH * 0.32);
    const pillSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${pillW}" height="${pillH}"><rect x="0" y="0" width="${pillW}" height="${pillH}" rx="${radius}" ry="${radius}" fill="black" fill-opacity="0.55"/></svg>`;
    const pillBuf = Buffer.from(pillSvg);
    composites.push({
      input: pillBuf,
      top: pillTop,
      left: pillLeft,
      blend: "over",
    });
    composites.push({
      input: logoBuf,
      top: logoTopPx,
      left: logoLeftPx,
      blend: "over",
    });
  }

  const composed = await sharp(baseBuf)
    .composite(composites)
    .png({ compressionLevel: 9, quality: 92 })
    .toBuffer();

  if (size.width === size.height) {
    return composed;
  }
  return padPngToSquare(composed);
}

/** True when planned caption ink overlaps the brand reserve (for tests). */
export function captionInkOverlapsBrandReserve(bbox, reserve) {
  return Boolean(bbox && reserve && rectsOverlapPx(bbox, reserve));
}
