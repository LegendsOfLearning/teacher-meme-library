// Server-side meme renderer using sharp + SVG overlays.
//
// Fonts: see font-setup.js — must load BEFORE sharp so librsvg/fontconfig
// can find Anton + Comic Neue on Vercel (FONTCONFIG_FILE → /tmp).
//
// Internal font family names (TTF name table):
//   Anton-Regular.ttf   -> "Anton" (weight 400)
//   ComicNeue-Bold.ttf  -> "Comic Neue" (weight 700)
//
// ── Style keys ──
//   "caption": Anton, ALL CAPS, white fill, heavy black stroke.
//   "mocking": Anton + alternating mIxEd cAsE.
//   "sign":    Anton, ALL CAPS, dark fill on cream sign.
//   "doge":    Comic Neue Bold, lowercase, colored fill + black stroke.

import "./font-setup.js";
import sharp from "sharp";
import path from "node:path";
import { promises as fs } from "node:fs";
import { ensureFontsInstalled } from "./font-setup.js";

export { ensureFontsInstalled };

// Must match fontconfig binding in font-setup.js.
const ANTON_FAMILY = "Anton";
const ANTON_WEIGHT = 400;
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
// Prefer bottom-right; collision logic may move the logo to keep captions clear.
export const BRAND_WATERMARK_CORNER = "br";
export const MEME_LOOP_FOOTER_TEXT =
  "Create your own meme at www.teacher-memes.com";

/** Clean UI font stack for the footer signature line (Montserrat bundled). */
const FOOTER_FONT =
  "Montserrat, 'Segoe UI', system-ui, -apple-system, sans-serif";

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

  // Top/bottom caption bands span the full width on real memes.
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
    // Both top + bottom caption bands: no safe image corner. Prefer top
    // corners only when there is NO top band; otherwise bottom. When both
    // exist, return empty so the caller can fall back to letterbox / mid-edge.
    if (topBand && bottomBand) {
      allowed = [];
    } else if (bottomBand) {
      allowed = ["tr", "tl"];
    } else if (topBand) {
      allowed = ["br", "bl"];
    } else {
      allowed = [...WATERMARK_CORNER_PRIORITY];
    }
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

    const shrinkFloor = Math.min(zone.minFontSize ?? 22, 22);
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
    curStroke = strokeRatio > 0
      ? Math.min(40, Math.max(5, curFs * strokeRatio))
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
    strokeWidth = strokeRatio > 0
      ? Math.min(40, Math.max(5, fs * strokeRatio))
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

const FOOTER_BAND_MIN_FRAC = 0.085;
/** Minimum letterbox height for a top/bottom caption band (above footer). */
const CAPTION_LETTERBOX_FRAC = 0.145;

/**
 * The deliberate horizontal bands on the square canvas, as canvas fractions.
 *
 * Full-bleed is the default (Shaun, 2026-08-25: "utilizing every possible
 * pixel"), so the ONLY black the renderer ever creates is a band it was
 * asked for:
 *   top    — a format that puts a caption in a top letterbox band
 *   bottom — the same for a bottom band
 *   footer — the brand CTA strip, always present unless includeFooter: false
 * Everything between contentTop and contentBottom is art, edge to edge.
 * Side pillars are never produced; art is cover-cropped, never padded.
 */
export function computeBandPlan(
  format,
  captions = {},
  { includeFooter = true, side = 1200 } = {}
) {
  const zones = format?.zones || [];
  const wants = (edge) =>
    zones.some(
      (z) =>
        z.placeInLetterbox === edge &&
        captions?.[z.key] != null &&
        String(captions[z.key]).trim() !== ""
    );
  // Derive the footer fraction from the footer's own metrics so the reserved
  // strip and the painted strip are the same pixels (no seam, no gap).
  const footerFrac = includeFooter
    ? footerBandMetrics(side, side).bandHeight / side
    : 0;
  const topFrac = wants("top") ? CAPTION_LETTERBOX_FRAC : 0;
  const bottomCaptionFrac = wants("bottom") ? CAPTION_LETTERBOX_FRAC : 0;
  return {
    topFrac,
    bottomCaptionFrac,
    footerFrac,
    contentTop: topFrac,
    contentBottom: 1 - bottomCaptionFrac - footerFrac,
    cropPosition: format?.cropPosition || "centre",
  };
}

/** First/last image row that is not a solid near-black letterbox bar. */
async function detectBlackBandRows(imageBuf) {
  const { data, info } = await sharp(imageBuf)
    .flatten({ background: { r: 0, g: 0, b: 0 } })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const DARK = 24; // near-pure black only — dark photo pixels are not a bar
  const BAND_RATIO = 0.92;
  const isBandRow = (y) => {
    let dark = 0;
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * channels;
      if (data[i] < DARK && data[i + 1] < DARK && data[i + 2] < DARK) dark += 1;
    }
    return dark / width >= BAND_RATIO;
  };
  // Take the LONGEST run of non-band rows, not the first/last one. Curated
  // gallery cards print their footer line inside the bottom black bar, and a
  // scan that just walks in from the edges stops at that text and hands back a
  // "photo" that still carries half the bar (which then lands in the canvas).
  let best = { top: 0, bottom: 0 };
  let runStart = null;
  for (let y = 0; y <= height; y += 1) {
    const band = y === height ? true : isBandRow(y);
    if (!band && runStart === null) runStart = y;
    if (band && runStart !== null) {
      if (y - runStart > best.bottom - best.top) best = { top: runStart, bottom: y };
      runStart = null;
    }
  }
  return { top: best.top, bottom: best.bottom, width, height };
}

/**
 * The region of the source file that actually holds the art.
 *
 * Curated gallery PNGs ship as squares with the real art letterboxed inside
 * black bars (a 1536×1024 image saved as 1536×1536). Zone fractions are
 * authored against the ART, not the file, and full-bleed means those baked
 * bars must be cropped away rather than scaled into the canvas as dead black.
 *
 * Self-validating: the trim is only taken when it moves the source closer to
 * the aspect ratio the format declares, so a plain template with a genuinely
 * dark top edge is left alone.
 */
async function resolveSourceArtRect(imageBuf, format) {
  const { top, bottom, width, height } = await detectBlackBandRows(imageBuf);
  const full = { left: 0, top: 0, width, height };
  const runH = bottom - top;
  // Guard: a mostly-black source (a broken mask) must not be "trimmed" to a sliver.
  if (runH < height * 0.4 || runH > height * 0.985) return full;
  if (!format?.width || !format?.height) return full;
  const want = format.width / format.height;

  // Art whose own bottom edge is near-black (a night scene, a dark coat) ends
  // the run early. The format declares the art's aspect ratio, so snap the
  // rect to the height that ratio implies, anchored at the first art row.
  let artTop = top;
  let artH = runH;
  const idealH = Math.round(width / want);
  if (idealH >= artH && idealH <= height) {
    artTop = Math.min(top, height - idealH);
    artH = idealH;
  }

  const fileFit = Math.abs(width / height - want);
  const artFit = Math.abs(width / artH - want);
  return artFit < fileFit
    ? { left: 0, top: artTop, width, height: artH }
    : full;
}

/**
 * Build the square canvas: art cover-cropped edge to edge into the content
 * rect, deliberate bands (and nothing else) left black.
 *
 * Returns the canvas plus `artRect` — where the WHOLE source art landed in
 * canvas fractions, including the parts cropped off the edges. Zone fractions
 * are art-space, so every zone is mapped through this rect.
 */
async function composeFullBleedSquare(srcBuf, srcRect, side, plan) {
  const contentTopPx = Math.round(side * plan.contentTop);
  const contentBottomPx = Math.round(side * plan.contentBottom);
  const contentH = Math.max(16, contentBottomPx - contentTopPx);

  // A format may pin the crop to one edge when centred cropping would eat a
  // load-bearing piece of the art (this-is-fine's speech bubble sits at the
  // right edge). Horizontal crops only; vertical stacks are banned outright.
  const cropPosition = plan.cropPosition || "centre";

  const art = await sharp(srcBuf)
    .extract(srcRect)
    .resize(side, contentH, {
      fit: "cover",
      position: cropPosition,
      kernel: "lanczos3",
    })
    .png()
    .toBuffer();

  const buf =
    contentTopPx === 0 && contentH === side
      ? art
      : await sharp({
          create: {
            width: side,
            height: side,
            channels: 4,
            background: { r: 0, g: 0, b: 0, alpha: 1 },
          },
        })
          .composite([{ input: art, top: contentTopPx, left: 0 }])
          .png({ compressionLevel: 9, quality: 92 })
          .toBuffer();

  // sharp's "cover" scales by max(w/inW, h/inH), then crops at `position`.
  const scale = Math.max(side / srcRect.width, contentH / srcRect.height);
  const artW = srcRect.width * scale;
  const artH = srcRect.height * scale;
  const artX =
    cropPosition === "west" ? 0 : cropPosition === "east" ? side - artW : (side - artW) / 2;
  return {
    buf,
    artRect: {
      x: artX / side,
      y: (contentTopPx + (contentH - artH) / 2) / side,
      w: artW / side,
      h: artH / side,
    },
  };
}

/** Pad PNG to 1:1 with black letterbox bars and room for the footer.
 *  Legacy: template build scripts only. renderMeme is full-bleed and never pads. */
export async function padPngToSquare(pngBuf) {
  const meta = await sharp(pngBuf).metadata();
  const side = Math.max(meta.width, meta.height);
  let buf = await sharp(pngBuf)
    .resize(side, side, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 1 },
      kernel: "lanczos3",
    })
    .png({ compressionLevel: 9, quality: 92 })
    .toBuffer();

  const fitted = await sharp(buf).metadata();
  const bounds = await detectLetterboxBandBounds(buf);
  const bottomStart = bounds?.bottomStartFrac
    ? Math.round(fitted.height * bounds.bottomStartFrac)
    : fitted.height;
  const bottomBandPx = fitted.height - bottomStart;
  const minFooterPx = Math.max(52, Math.round(fitted.width * FOOTER_BAND_MIN_FRAC));

  if (bottomBandPx >= minFooterPx) return buf;

  // Full-bleed squares get a dedicated footer bar by shrinking content
  // upward. Use fill (mild vertical squash ~8%) so width stays full —
  // fit:"inside" pillarboxed the art and left Drake panel text tiny /
  // misaligned in the white boxes.
  const contentH = Math.max(1, fitted.height - minFooterPx);
  const content = await sharp(buf)
    .resize(fitted.width, contentH, {
      fit: "fill",
      kernel: "lanczos3",
    })
    .png()
    .toBuffer();
  const contentMeta = await sharp(content).metadata();
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
        input: content,
        top: 0,
        left: Math.floor((side - contentMeta.width) / 2),
      },
    ])
    .png({ compressionLevel: 9, quality: 92 })
    .toBuffer();
}

function avgCharWidth(family) {
  if (family === COMIC_FAMILY) return 0.55;
  // Measured ~0.47 on Anton caps; slight cushion so wraps don't overflow.
  if (family === ANTON_FAMILY) return 0.48;
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

// Classic meme captions should dominate the zone — err oversized rather
// than subtitle-thin. Short punchlines still get a ceiling so they do
// not become a solid black slab.
const MAX_LINE_FS_RATIO = 0.92;

// Classic meme text: outline ≈ 1/10 of the font size (imgflip is ~1/15);
// the old 0.38 rendered slab-thick outlines that swallowed neighboring rows.
const CAPTION_STROKE_RATIO = 0.1;
// Leading between wrapped caption lines. 1.0 (none) made row strokes collide.
const CAPTION_LEADING = 1.12;

// Absolute smallest font fitText will ever choose. A caption that lands here
// is text the renderer could not fit any other way.
export const FIT_MIN_FS = 16;

// Choose font size + line layout. Tries every `k` in [2..maxLines],
// picks the largest font, then among sizes within 85% of that best,
// prefers fewer lines (avoids tiny 2-line wraps and amateurish pyramids).
function fitText(text, maxWidth, maxHeight, maxLines, family, startSize, opts = {}) {
  const words = String(text).trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return { fs: 12, lines: [""], lineHeight: 12 };
  }

  const fillPanel = Boolean(opts.fillPanel);
  const lineFsRatio = fillPanel ? 0.98 : MAX_LINE_FS_RATIO;
  // Panel text (Drake): underestimate width slightly so we fill the box;
  // overflow cushion is handled by the widthOk tolerances below.
  const charPerFs = avgCharWidth(family) * (fillPanel ? 0.9 : 1);
  const cap = Math.max(14, Math.floor(startSize));
  const charCount = words.join(" ").length;
  const MIN_FS = FIT_MIN_FS;
  // Shrink on one line first, but wrap before captions go subtitle-thin
  // in tall letterbox / edge bands (was flooring all the way to 20px).
  const SINGLE_LINE_FLOOR = Math.max(
    20,
    Math.min(56, Math.floor(maxHeight * 0.4))
  );

  // 1) Try a single line, shrinking until it fits.
  {
    let fs = Math.min(cap, Math.floor(maxHeight * lineFsRatio));
    while (fs >= SINGLE_LINE_FLOOR) {
      const widthOk = charCount * charPerFs * fs <= maxWidth * 1.02;
      const heightOk = fs <= maxHeight * 1.02;
      if (widthOk && heightOk) {
        // Drake-style panels: a short single line can "fit" while looking
        // tiny in a tall white box — fall through to multi-line if the
        // one-liner doesn't dominate the zone.
        if (fillPanel && fs < maxHeight * 0.32) break;
        return { fs, lines: [words.join(" ")], lineHeight: fs };
      }
      fs -= 1;
    }
  }

  if (maxLines <= 1) {
    let fs = Math.max(MIN_FS, Math.min(cap, Math.floor(maxWidth / (charCount * charPerFs))));
    fs = Math.min(fs, Math.floor(maxHeight * lineFsRatio));
    return { fs, lines: [words.join(" ")], lineHeight: fs };
  }

  const candidates = [];
  const lim = Math.min(maxLines, words.length);
  for (let k = 2; k <= lim; k++) {
    const split = balancedSplit(words, k);
    if (!split) continue;

    const lineSlot = maxHeight / k / CAPTION_LEADING;
    const widthFs = maxWidth / (split.maxChars * charPerFs);
    const heightFs = lineSlot * lineFsRatio;
    let fs = Math.floor(Math.min(widthFs, heightFs, cap));
    if (charCount <= 6 && k === 1) {
      fs = Math.floor(Math.min(fs, lineSlot * 0.38, widthFs * 0.55));
    }
    if (fs < MIN_FS) continue;
    candidates.push({ fs, lines: split.lines, k });
  }

  if (candidates.length === 0) {
    let fs = Math.min(cap, Math.floor(maxHeight * lineFsRatio));
    fs = Math.max(MIN_FS, fs);
    let lines = wrapText(text, maxWidth, fs, family);
    while (fs > MIN_FS) {
      lines = wrapText(text, maxWidth, fs, family);
      const tallOk = lines.length * fs * CAPTION_LEADING <= maxHeight + 1;
      const lineOk = lines.length <= maxLines;
      const widest = Math.max(...lines.map((l) => l.length), 1);
      const wideOk = widest * charPerFs * fs <= maxWidth * 1.04;
      if (tallOk && lineOk && wideOk) break;
      fs -= 1;
    }
    lines = wrapText(text, maxWidth, fs, family);
    return {
      fs,
      lines,
      lineHeight: lines.length > 1 ? Math.round(fs * CAPTION_LEADING) : fs,
    };
  }

  // Prefer the largest readable size; among near-best sizes, fewer lines.
  const bestFs = Math.max(...candidates.map((c) => c.fs));
  const nearRatio = fillPanel ? 0.95 : 0.85;
  const nearBest = candidates.filter((c) => c.fs >= bestFs * nearRatio);
  nearBest.sort((a, b) => a.k - b.k || b.fs - a.fs);
  const chosen = nearBest[0];
  return {
    fs: chosen.fs,
    lines: chosen.lines,
    lineHeight:
      chosen.lines.length > 1
        ? Math.round(chosen.fs * CAPTION_LEADING)
        : chosen.fs,
  };
}

function resolveZoneStyle(zone) {
  switch (zone.style) {
    case "mocking":
      return {
        family: ANTON_FAMILY,
        weight: ANTON_WEIGHT,
        transform: toMockingCase,
        fill: "#ffffff",
        stroke: "#000000",
        strokeRatio: CAPTION_STROKE_RATIO,
      };
    case "sign":
      return {
        family: ANTON_FAMILY,
        weight: ANTON_WEIGHT,
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
        family: ANTON_FAMILY,
        weight: ANTON_WEIGHT,
        transform: (s) => s.toUpperCase(),
        fill: "#000000",
        stroke: "none",
        strokeRatio: 0,
      };
    case "caption-inverted":
      return {
        family: ANTON_FAMILY,
        weight: ANTON_WEIGHT,
        transform: (s) => s.toUpperCase(),
        fill: "#000000",
        stroke: "#ffffff",
        strokeRatio: CAPTION_STROKE_RATIO,
      };
    case "caption":
    default:
      return {
        family: ANTON_FAMILY,
        weight: ANTON_WEIGHT,
        transform: (s) => s.toUpperCase(),
        fill: "#ffffff",
        stroke: "#000000",
        strokeRatio: CAPTION_STROKE_RATIO,
      };
  }
}

// Minimum render width. Templates ship at varying native resolutions
// (Crying Cat is 300×300, Drake is 1200×1200). Rendering each at its
// native size makes the small ones look thin and amateurish compared
// to the curated gallery — Anton reads better with more
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

/**
 * The renderer's own fit decision for one zone, exposed so non-rendering
 * callers (the deterministic render lint) can ask "how will this caption
 * actually lay out?" without re-implementing fitText's heuristics.
 * Returns null for an empty caption.
 */
export function measureZoneFit(zone, rawText, imgW, imgH) {
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
  const maxLines = zone.maxLines ?? 2;
  let fit = fitText(text, w, h, maxLines, style.family, startSize);
  if (zoneMinFs > 0 && fit.fs < zoneMinFs) {
    const retry = fitText(
      text,
      w,
      h,
      maxLines,
      style.family,
      Math.max(zoneMinFs, zoneMaxFs, startSize)
    );
    fit = retry.fs >= zoneMinFs ? retry : { ...retry, fs: zoneMinFs };
  }
  return {
    fs: fit.fs,
    lines: fit.lines,
    lineHeight: fit.lineHeight,
    text,
    boxW: w,
    boxH: h,
    maxLines,
    family: style.family,
    charWidth: avgCharWidth(style.family),
    lineLeading: CAPTION_LEADING,
    minFontSize: zoneMinFs,
    maxFontSize: zoneMaxFs,
    absoluteFloorFs: FIT_MIN_FS,
  };
}

function measureZoneFs(zone, rawText, imgW, imgH) {
  return measureZoneFit(zone, rawText, imgW, imgH)?.fs ?? null;
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

function renderZone(zone, rawText, imgW, imgH, watermark, syncCapFs, coverBaked, galleryEdit = false) {
  if (rawText == null || String(rawText).trim() === "") {
    return { fragment: "", bbox: null };
  }
  let style = resolveZoneStyle(zone);
  if (typeof zone.strokeRatio === "number" && Number.isFinite(zone.strokeRatio)) {
    style = { ...style, strokeRatio: Math.max(0, zone.strokeRatio) };
  }
  if (coverBaked && style.strokeRatio > 0) {
    style = {
      ...style,
      strokeRatio: Math.min(0.5, style.strokeRatio * 1.7),
    };
  }
  const text = style.transform(normalizeCaptionText(String(rawText).trim()));

  let x = zone.x * imgW;
  let y = zone.y * imgH;
  let w = zone.w * imgW;
  let h = zone.h * imgH;

  // Keep glyphs inside the band — reduces face/body overlap.
  // Letterbox: extra inset so stroke never bleeds onto the photo / into footer.
  // White panel text (Drake, etc.): fill the box — small margins only.
  const isPanelText =
    zone.style === "dark-on-light" || zone.style === "sign";
  const padX = Math.max(4, w * 0.04);
  const padY = Math.max(
    4,
    h * (zone.placeInLetterbox ? 0.12 : isPanelText ? 0.04 : 0.08)
  );
  x += padX;
  y += padY;
  w = Math.max(8, w - padX * 2);
  h = Math.max(8, h - padY * 2);

  const isBottomBand = zone.y + zone.h > 0.62;
  if (watermark?.reservePx) {
    ({ x, y, w, h } = applyReserveToZone(
      { x, y, w, h, isBottomBand },
      watermark.reservePx,
      watermark.corner
    ));
  }

  const naturalStart = Math.min(
    h * (isPanelText ? 0.92 : 0.78),
    w * (isPanelText ? 0.55 : 0.4)
  );
  // Keep captions inside the band — stroke needs headroom too.
  // Panel text should dominate the white box (classic Drake look).
  let zoneMaxFs = Math.floor(
    h *
      (zone.placeInLetterbox ? 0.62 : isPanelText ? 0.9 : 0.65)
  );
  if (typeof zone.maxFontSize === "number") {
    zoneMaxFs = Math.min(zoneMaxFs, zone.maxFontSize);
  }
  const zoneMinFs =
    zone.minFontSize ??
    (zone.style === "doge"
      ? 28
      : zone.style === "sign" || zone.style === "dark-on-light"
        ? 36
        : zone.style === "caption" || zone.style === "caption-inverted" || zone.style === "mocking"
          ? zone.placeInLetterbox
            ? 28
            : 24
          : 0);
  let startSize = Math.max(zoneMinFs || 0, Math.min(naturalStart, zoneMaxFs));
  if (syncCapFs != null) {
    startSize = Math.min(startSize, syncCapFs);
  }

  const fitOpts = { fillPanel: isPanelText };
  let { fs, lines, lineHeight } = fitText(
    text,
    w,
    h,
    zone.maxLines ?? 2,
    style.family,
    startSize,
    fitOpts
  );

  // Prefer minFontSize when it still fits; never force a floor that overflows
  // the zone (that caused cut-off / blackout captions).
  if (zoneMinFs > 0 && fs < zoneMinFs) {
    const retry = fitText(
      text,
      w,
      h,
      zone.maxLines ?? 2,
      style.family,
      Math.max(zoneMinFs, startSize),
      fitOpts
    );
    const fits =
      retry.lines.length * retry.fs <= h * 0.98 &&
      retry.lines.every(
        (line) => line.length * avgCharWidth(style.family) * retry.fs <= w * 1.05
      );
    if (fits && retry.fs >= zoneMinFs * 0.85) {
      ({ fs, lines, lineHeight } = retry);
    }
  }

  // Hard cap: glyph block + stroke must stay inside the padded zone.
  const strokeBudget = style.strokeRatio > 0 ? style.strokeRatio * 0.55 : 0;
  const maxBlock = h / (1 + strokeBudget);
  if (lines.length * fs > maxBlock) {
    const cappedFs = Math.max(16, Math.floor(maxBlock / lines.length));
    const capped = fitText(
      text,
      w,
      h,
      zone.maxLines ?? 2,
      style.family,
      cappedFs,
      fitOpts
    );
    fs = Math.min(capped.fs, cappedFs);
    lines = capped.lines;
    lineHeight = capped.lineHeight;
  }

  if (syncCapFs != null && fs > syncCapFs) {
    const capped = fitText(
      text,
      w,
      h,
      zone.maxLines ?? 2,
      style.family,
      syncCapFs,
      fitOpts
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
      ? Math.min(40, Math.max(5, fs * style.strokeRatio))
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

  const mkText = (line, i, paintAttrs) => {
    const ly = firstBaseline + i * lineHeight;
    const weightAttr = style.weight ? ` font-weight="${style.weight}"` : "";
    return `<text x="${tx.toFixed(2)}" y="${ly.toFixed(
      2
    )}" font-family="${style.family}" font-size="${fs.toFixed(
      2
    )}"${weightAttr}${paintAttrs} text-anchor="${anchor}">${escXml(line)}</text>`;
  };
  // A line's stroke must never paint over a neighboring line's fill —
  // paint-order only sorts stroke/fill within ONE element, so multi-line
  // blocks need all strokes drawn first, then all fills on top.
  const strokePassAttrs =
    strokeWidthFinal > 0
      ? ` fill="none" stroke="${style.stroke}" stroke-width="${strokeWidthFinal.toFixed(
          2
        )}" stroke-linejoin="round"`
      : null;
  const textEls = [
    ...(strokePassAttrs ? lines.map((l, i) => mkText(l, i, strokePassAttrs)) : []),
    ...lines.map((l, i) => mkText(l, i, ` fill="${style.fill}"`)),
  ].join("\n");

  let fragment = textEls;
  // Clip letterbox captions so stroke never bleeds onto the photo or footer.
  if (zone.placeInLetterbox && fragment) {
    const clipId = `lb-${zone.key}-${Math.round(zone.x * 1000)}`;
    const cx = zone.x * imgW;
    const cy = zone.y * imgH;
    const cw = zone.w * imgW;
    const ch = zone.h * imgH;
    fragment = `<defs><clipPath id="${clipId}"><rect x="${cx.toFixed(1)}" y="${cy.toFixed(1)}" width="${cw.toFixed(1)}" height="${ch.toFixed(1)}"/></clipPath></defs><g clip-path="url(#${clipId})">${fragment}</g>`;
  }
  // Gallery edits smudge baked pixels first — only re-draw caption glyphs.
  if (coverBaked && lines.some((l) => l.trim()) && !zone.maskTight && !galleryEdit) {
    const bleedX = w * 0.04;
    const bleedY = h * 0.5;
    const mx = Math.max(0, x - bleedX);
    const my = Math.max(0, y - bleedY);
    const mw = Math.min(imgW - mx, w + bleedX * 2);
    const mh = Math.min(imgH - my, h + bleedY * 2);
    const zoneMask = `<rect x="${mx.toFixed(2)}" y="${my.toFixed(
      2
    )}" width="${mw.toFixed(2)}" height="${mh.toFixed(2)}" fill="#000000"/>`;
    fragment = `${zoneMask}\n${fragment}`;
  }
  if (coverBaked && strokeWidthFinal > 0) {
    const knockoutPasses = galleryEdit
      ? [{ fill: "#000000", stroke: "#000000", mult: 2.2 }]
      : [{ fill: "#000000", stroke: "#000000", mult: 3.5 }];
    const knockout = knockoutPasses
      .flatMap(({ fill, stroke, mult }) =>
        lines.map((line, i) => {
          const ly = firstBaseline + i * lineHeight;
          const kStroke = Math.min(96, strokeWidthFinal * mult);
          return `<text x="${tx.toFixed(2)}" y="${ly.toFixed(
            2
          )}" font-family="${style.family}" font-size="${fs.toFixed(
            2
          )}" fill="${fill}" stroke="${stroke}" stroke-width="${kStroke.toFixed(
            2
          )}" stroke-linejoin="round" paint-order="stroke fill" text-anchor="${anchor}">${escXml(line)}</text>`;
        })
      )
      .join("\n");
    fragment = `${knockout}\n${textEls}`;
  }

  // Tight mask boxes are for static templates only — never on gallery edits.
  if (zone.maskTight && !galleryEdit && lines.some((l) => l.trim())) {
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

async function buildSvgOverlay(format, captions, watermark, size, coverBaked = false, galleryEdit = false) {
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
      coverBaked,
      galleryEdit
    );
    if (rendered?.fragment) parts.push(rendered.fragment);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
${fontStyle}
${parts.join("\n")}
</svg>`;
}

/** Place logo inside the top black letterbox bar when one exists. */
async function tryLetterboxWatermarkPlacement(size, letterboxBounds, opts = {}) {
  if (!letterboxBounds?.topEndFrac) return null;
  const topBarH = Math.round(size.height * letterboxBounds.topEndFrac);
  const minBarPx = opts.minBarPx ?? 32;
  if (topBarH < minBarPx) return null;

  // Shrink logo to fit inside a tight letterbox bar when needed.
  let logoScale = opts.allowTight ? 0.55 : 0.7;
  let logoTargetW = computeLogoTargetWidth(size.width, logoScale);
  let logoBuf = await loadLogoBuffer(logoTargetW);
  let logoMeta = await sharp(logoBuf).metadata();
  const margin = Math.max(8, Math.round(size.width * 0.016));
  let pillPadX = Math.round(logoMeta.width * 0.14);
  let pillPadY = Math.round(logoMeta.height * 0.28);
  let pillH = logoMeta.height + pillPadY * 2;

  while (pillH > topBarH - 4 && logoScale > 0.28) {
    logoScale *= 0.85;
    logoTargetW = computeLogoTargetWidth(size.width, logoScale);
    logoBuf = await loadLogoBuffer(logoTargetW);
    logoMeta = await sharp(logoBuf).metadata();
    pillPadX = Math.round(logoMeta.width * 0.12);
    pillPadY = Math.round(logoMeta.height * 0.22);
    pillH = logoMeta.height + pillPadY * 2;
  }

  const pillW = logoMeta.width + pillPadX * 2;
  const pillLeft = size.width - pillW - margin;
  const pillTop = Math.max(0, Math.round((topBarH - pillH) / 2));
  const reservePx = {
    left: Math.max(0, pillLeft - WATERMARK_CLEARANCE_PX),
    top: Math.max(0, pillTop - WATERMARK_CLEARANCE_PX),
    right: size.width,
    bottom: Math.min(size.height, pillTop + pillH + WATERMARK_CLEARANCE_PX),
  };

  return attachWatermarkPixelCoords(
    {
      corner: "tr",
      logoScale,
      logoBuf,
      logoMeta,
      margin,
      pillPadX,
      pillPadY,
      pillW,
      pillH,
      reservePx,
      score: 0,
      violations: 0,
      letterbox: true,
      pillLeft,
      pillTop,
    },
    size
  );
}

function attachWatermarkPixelCoords(plan, size) {
  if (plan.letterbox && plan.pillLeft != null && plan.pillTop != null) {
    const { logoMeta, pillPadX, pillPadY, pillW, pillH, pillLeft, pillTop } =
      plan;
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
 * Place the Legends logo so it never covers caption ink.
 * Prefers the top letterbox bar when present and clear; otherwise picks
 * the lowest-collision corner (br → bl → tr → tl) and scales the logo down.
 * When top+bottom caption bands block every corner, force letterbox placement
 * (shrinking the logo to fit the top bar) instead of overlapping text.
 */
export async function resolveWatermarkPlacement(
  format,
  captions,
  size,
  opts = {}
) {
  const letterboxBounds = opts.letterboxBounds || null;
  const letterboxPlan = await tryLetterboxWatermarkPlacement(
    size,
    letterboxBounds
  );
  if (letterboxPlan) {
    const captionBboxes = layoutCaptionBboxes(format, captions, size, {
      corner: letterboxPlan.corner,
      reservePx: letterboxPlan.reservePx,
    });
    const hits = captionBboxes.some((bbox) =>
      captionInkOverlapsBrandReserve(bbox, letterboxPlan.reservePx)
    );
    if (!hits) return letterboxPlan;
  }

  const W = size.width;
  const H = size.height;
  const staticObstacles = collectStaticObstacles(format, W, H);
  const preferred = cornerPriority(format);
  const corners = cornersAllowedForObstacles(
    staticObstacles,
    W,
    H,
    preferred
  );

  // No safe image corner (typical top+bottom caption formats): keep the logo
  // in the top letterbox even if the bar is tight, rather than covering text.
  if (corners.length === 0) {
    const forced = await tryLetterboxWatermarkPlacement(size, letterboxBounds, {
      minBarPx: 24,
      allowTight: true,
    });
    if (forced) return forced;
  }

  let best = null;

  for (const logoScale of LOGO_SCALE_STEPS) {
    const logoTargetW = computeLogoTargetWidth(W, logoScale);
    const logoBuf = await loadLogoBuffer(logoTargetW);
    const logoMeta = await sharp(logoBuf).metadata();
    const margin = Math.max(12, Math.round(W * 0.02));
    const pillPadX = Math.round(logoMeta.width * 0.16);
    const pillPadY = Math.round(logoMeta.height * 0.32);

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

  if (best && best.violations === 0) {
    return attachWatermarkPixelCoords(best, size);
  }

  // Last resort: letterbox (even tight), never stack on caption ink.
  const forcedLetterbox = await tryLetterboxWatermarkPlacement(
    size,
    letterboxBounds,
    { minBarPx: 20, allowTight: true }
  );
  if (forcedLetterbox) return forcedLetterbox;

  if (best) {
    return attachWatermarkPixelCoords(best, size);
  }

  const fallbackCorner = corners[0] || "tr";
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
// Gallery thumbnail → caption-free template for edits. Keeps curated
// gallery art without baking captions into the edit base.
export const GALLERY_RENDER_SOURCES = {
  "/gallery/boromir-backup.png":
    "/templates-meme/one-does-not-simply-gallery.png",
  "/gallery/disaster-girl-admin.png":
    "/templates-meme/disaster-girl.jpg",
  "/gallery/grumpy-cat-plans.png":
    "/templates-meme/grumpy-cat.jpg",
  "/gallery/crying-cat-papers.png":
    "/templates-meme/crying-cat.jpg",
  "/gallery/crying-cat-copier.png":
    "/templates-meme/crying-cat.jpg",
};

function isGalleryPath(filePath) {
  return typeof filePath === "string" && filePath.includes("/gallery/");
}

/** Erase rect for baked gallery captions (letterbox bars vs on-photo zones). */
function zoneEraseRect(zone, W, H, { letterbox = true, bandBounds = null, onPhoto = false } = {}) {
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
    const padY = zone.h * (onPhoto ? 0.65 : 0.35);
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

/** Pixel-scan black letterbox bars so erase stays off the photo. */
export async function detectLetterboxBandBounds(imageBuf) {
  const { data, info } = await sharp(imageBuf)
    .raw()
    .toBuffer({ resolveWithObject: true });
  const W = info.width;
  const H = info.height;
  const DARK = 12; // near-pure black only — dark photo pixels are not letterbox

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
    topEndFrac: Math.min(0.28, (topEnd + pad) / H),
    bottomStartFrac: Math.max(0.7, (bottomStart - pad) / H),
  };
}

/** Footer band metrics — thin CTA strip pinned to the bottom edge.
 *  Must NOT fill the whole letterbox: bottom meme captions live above this. */
export function footerBandMetrics(width, height, letterboxBounds = null, text = MEME_LOOP_FOOTER_TEXT) {
  // Readable on gallery cards (~600px) and full-size downloads.
  const maxTextWidth = width * 0.94;
  const charEm = 0.5;
  let fontSize = Math.max(16, Math.min(36, Math.round(width * 0.032)));
  while (fontSize > 16 && String(text).length * fontSize * charEm > maxTextWidth) {
    fontSize -= 1;
  }
  const minBand = Math.max(
    Math.round(fontSize * 2.4),
    Math.round(height * FOOTER_BAND_MIN_FRAC)
  );
  const bandTop = Math.max(0, height - minBand);
  const bandHeight = height - bandTop;
  const textY = bandTop + Math.round(bandHeight / 2);
  return { fontSize, bandTop, bandHeight, textY };
}

/** Height of the footer signature area for strip-clearing on edits. */
function footerSignatureHeight(width, height, letterboxBounds = null) {
  return footerBandMetrics(width, height, letterboxBounds).bandHeight;
}

/** Clear the baked footer area so new bottom captions do not compete. */
async function stripGalleryFooterBand(baseBuf, width, height, letterboxBounds) {
  const sigH = footerSignatureHeight(width, height, letterboxBounds);
  const top = height - sigH;
  const svg = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect x="0" y="${top}" width="${width}" height="${sigH}" fill="#000000"/></svg>`
  );
  return sharp(baseBuf).composite([{ input: svg, top: 0, left: 0 }]).toBuffer();
}

/** Remove a legacy LoL logo baked into a corner (pill + mark). */
async function smudgeBrandCornerPatch(
  baseBuf,
  size,
  { leftFrac, topFrac, wFrac = 0.36, hFrac = 0.14 }
) {
  const width = Math.round(size.width * wFrac);
  const height = Math.round(size.height * hFrac);
  const left = Math.round(
    Math.max(0, Math.min(size.width - width, size.width * leftFrac))
  );
  const top = Math.round(
    Math.max(0, Math.min(size.height - height, size.height * topFrac))
  );
  if (width < 8 || height < 8) return baseBuf;

  const factor = Math.max(8, Math.round(Math.min(width, height) / 5));
  const patch = await sharp(baseBuf)
    .extract({ left, top, width, height })
    .resize(
      Math.max(1, Math.round(width / factor)),
      Math.max(1, Math.round(height / factor)),
      { kernel: sharp.kernel.cubic }
    )
    .resize(width, height, { kernel: sharp.kernel.cubic })
    .blur(Math.max(6, Math.round(height * 0.12)))
    .toBuffer();
  return sharp(baseBuf)
    .composite([{ input: patch, top, left }])
    .toBuffer();
}

/** Strip baked LoL corner logos from templates / old gallery PNGs. */
export async function smudgeLegacyBrandCorners(baseBuf, size, letterboxBounds = null) {
  let out = baseBuf;
  const topBand = letterboxBounds?.topEndFrac ?? 0;
  // Logos sit on the photo, just under any top letterbox bar.
  const topFrac = Math.min(0.2, topBand + 0.005);
  out = await smudgeBrandCornerPatch(out, size, {
    leftFrac: 0.62,
    topFrac,
    wFrac: 0.38,
    hFrac: 0.16,
  });
  out = await smudgeBrandCornerPatch(out, size, {
    leftFrac: 0.0,
    topFrac,
    wFrac: 0.38,
    hFrac: 0.16,
  });
  // Second pass a bit lower for logos that sat below caption bands.
  out = await smudgeBrandCornerPatch(out, size, {
    leftFrac: 0.66,
    topFrac: topFrac + 0.06,
    wFrac: 0.34,
    hFrac: 0.12,
  });
  return out;
}

/** @deprecated Use smudgeLegacyBrandCorners — kept name for older call sites. */
async function smudgeLegacyBrandCorner(baseBuf, size, letterboxBounds) {
  return smudgeLegacyBrandCorners(baseBuf, size);
}

/** Blur baked caption areas once at template-build time. */
export async function smudgeCaptionZones(baseBuf, zones, size) {
  const W = size.width;
  const H = size.height;
  let out = baseBuf;
  for (const zone of zones) {
    if (zone.decorative) continue;
    const rect = zoneEraseRect(zone, W, H, {
      letterbox: false,
      onPhoto: true,
    });
    const left = Math.round(Math.max(0, rect.x));
    const top = Math.round(Math.max(0, rect.y));
    const width = Math.round(Math.min(W - left, rect.w));
    const height = Math.round(Math.min(H - top, rect.h));
    if (width < 8 || height < 8) continue;
    // Aggressive downscale destroys text structure, then blur smooths
    // the mosaic artifacts so the knockout blends naturally.
    const factor = Math.max(12, Math.round(Math.min(width, height) / 6));
    const sw = Math.max(1, Math.round(width / factor));
    const sh = Math.max(1, Math.round(height / factor));
    const blurSigma = Math.max(2, Math.round(Math.min(width, height) * 0.04));
    const patch = await sharp(out)
      .extract({ left, top, width, height })
      .resize(sw, sh, { kernel: sharp.kernel.cubic })
      .resize(width, height, { kernel: sharp.kernel.cubic })
      .blur(blurSigma)
      .toBuffer();
    out = await sharp(out)
      .composite([{ input: patch, top, left }])
      .toBuffer();
  }
  return out;
}

function isGalleryEditSource(sourceFile) {
  return isGalleryPath(sourceFile);
}

export function resolveGalleryEditTemplate(format, galleryFile, { forEdit = false } = {}) {
  if (format.galleryTemplate && galleryFile) {
    return format.galleryTemplate;
  }
  if (galleryFile && GALLERY_RENDER_SOURCES[galleryFile]) {
    return GALLERY_RENDER_SOURCES[galleryFile];
  }
  const stock = format.renderFile || format.file;
  // Prefer a blank stock template for edits whenever one exists — erasing
  // baked captions from dark gallery art (e.g. Surprised Pikachu) can wipe
  // the whole photo. Fall back to gallery PNG erase only when needed.
  if (
    forEdit &&
    typeof stock === "string" &&
    stock.includes("/templates-meme/")
  ) {
    return stock;
  }
  if (forEdit && galleryFile && isGalleryPath(galleryFile)) {
    return galleryFile;
  }
  return stock;
}

/** Format + zones to use when rendering a gallery edit. */
export function resolveGalleryEditFormat(format, galleryFile) {
  if (!galleryFile || !isGalleryPath(galleryFile)) return format;
  const template = resolveGalleryEditTemplate(format, galleryFile);
  const usesGalleryTemplate =
    (format.galleryTemplate && template === format.galleryTemplate) ||
    GALLERY_RENDER_SOURCES[galleryFile] === template;
  if (usesGalleryTemplate && format.galleryZones?.length) {
    return { ...format, zones: format.galleryZones };
  }
  return format;
}

function resolveRenderSource(format, sourceFile) {
  // Gallery edits render from a clean template — never the captioned
  // gallery card PNG (avoids blur/smudge artifacts on baked text).
  if (sourceFile && isGalleryPath(sourceFile)) {
    return resolveGalleryEditTemplate(format, sourceFile);
  }
  if (sourceFile) return sourceFile;
  return format.renderFile || format.file;
}

/**
 * Blur out the captions baked into a curated gallery PNG, in ART space.
 *
 * The old path filled these zones with solid black rectangles, which is the
 * opposite of full-bleed: it wrote new dead-black slabs onto the photo (and
 * on stonks, whose bottom zone is 34% tall, it blacked out the lower third of
 * the image and then blurred what was left). A destructive downscale + blur
 * removes the glyph structure while keeping photographic pixels everywhere;
 * each of these formats declares maskTight, so the new caption draws its own
 * plate over whatever smear is left.
 */
async function smudgeBakedGalleryCaptions(baseBuf, format, srcRect) {
  let out = baseBuf;
  const meta = await sharp(baseBuf).metadata();
  for (const zone of format.zones || []) {
    if (zone.decorative) continue;
    const padX = zone.w * 0.03;
    const padY = zone.h * 0.22;
    const rect = {
      x: srcRect.left + (zone.x - padX) * srcRect.width,
      y: srcRect.top + (zone.y - padY) * srcRect.height,
      w: (zone.w + padX * 2) * srcRect.width,
      h: (zone.h + padY * 2) * srcRect.height,
    };
    out = await blurOutRect(out, rect, meta.width, meta.height);
  }
  return out;
}

/** Destroy text structure inside one rect, then blur the mosaic smooth. */
async function blurOutRect(buf, rect, imgW, imgH) {
  const left = Math.round(Math.max(0, rect.x));
  const top = Math.round(Math.max(0, rect.y));
  const width = Math.round(Math.min(imgW - left, rect.w));
  const height = Math.round(Math.min(imgH - top, rect.h));
  if (width < 8 || height < 8) return buf;
  // Meme glyphs are huge and high-contrast: a gentle mosaic leaves ghost text
  // that is still readable next to the new caption. Crush to ~4 blocks across
  // the short side, then blur wider than a block so nothing legible survives.
  const short = Math.min(width, height);
  const factor = Math.max(16, Math.round(short / 4));
  const patch = await sharp(buf)
    .extract({ left, top, width, height })
    .resize(
      Math.max(1, Math.round(width / factor)),
      Math.max(1, Math.round(height / factor)),
      { kernel: sharp.kernel.cubic }
    )
    .resize(width, height, { kernel: sharp.kernel.cubic })
    .blur(Math.max(6, Math.round(short * 0.12)))
    .toBuffer();
  return sharp(buf).composite([{ input: patch, top, left }]).toBuffer();
}

// A caption that spans the frame (classic top/bottom impact text) belongs to
// the FRAME, not to any feature in the art: when a cover crop slides the art
// up or sideways, the band must stay pinned to the visible edge or it gets
// clamped to a sliver and the caption shrinks to nothing. Anything narrower
// marks something in the picture — a panel, a face, a white box — and has to
// travel with the art instead. Decorative masks always cover art.
const FRAME_CAPTION_MIN_W = 0.85;

function isFrameCaption(zone) {
  return !zone.decorative && (zone.w ?? 0) >= FRAME_CAPTION_MIN_W;
}

/**
 * Zone fractions are authored in ART space. Map them onto the square canvas.
 *
 * Cover-cropping moves and scales the art, so a zone that marks a face, a
 * panel or a white box has to travel with it — mapping through `artRect` is
 * what keeps Drake's text in Drake's boxes after the crop. Zones that spill
 * past the canvas (a panel whose art was cropped away) are clamped back to
 * the visible content rect.
 *
 * Frame captions and letterbox captions skip that: they are laid out against
 * the content rect itself, keeping their full-canvas x/w.
 */
function mapFormatZonesToContent(format, plan, artRect) {
  const bandGap = 0.006;
  const span = Math.max(0.05, plan.contentBottom - plan.contentTop);
  return {
    ...format,
    zones: (format.zones || []).map((zone) => {
      if (zone.placeInLetterbox === "top" && plan.topFrac > 0) {
        return {
          ...zone,
          y: bandGap,
          h: Math.max(0.06, plan.topFrac - bandGap * 2),
        };
      }
      if (zone.placeInLetterbox === "bottom" && plan.bottomCaptionFrac > 0) {
        const y = plan.contentBottom + bandGap;
        return {
          ...zone,
          y,
          h: Math.max(0.06, 1 - plan.footerFrac - bandGap - y),
        };
      }
      if (isFrameCaption(zone)) {
        return {
          ...zone,
          y: plan.contentTop + zone.y * span,
          h: zone.h * span,
        };
      }
      const left = Math.max(0, artRect.x + zone.x * artRect.w);
      const right = Math.min(1, artRect.x + (zone.x + zone.w) * artRect.w);
      const top = Math.max(plan.contentTop, artRect.y + zone.y * artRect.h);
      const bottom = Math.min(
        plan.contentBottom,
        artRect.y + (zone.y + zone.h) * artRect.h
      );
      return {
        ...zone,
        x: left,
        y: top,
        w: Math.max(0.02, right - left),
        h: Math.max(0.02, bottom - top),
      };
    }),
  };
}

/**
 * Everything geometric about a render: the full-bleed square base, where the
 * art landed, and the zones mapped onto the canvas.
 *
 * Exported because the deterministic harness needs to ask "did this format's
 * caption zones survive the cover crop?" without re-deriving the math — a
 * zone whose mapped box is far smaller than its declared box is a zone whose
 * art was cropped out from under it.
 */
export async function planFullBleedRender(format, captions = {}, options = {}) {
  const cleanBase = options.cleanBase || format.renderFile || format.file;
  const templatePath = path.join(
    process.cwd(),
    "public",
    cleanBase.replace(/^\//, "")
  );

  const meta = await sharp(templatePath).metadata();
  const contentSize =
    meta.width >= 1000
      ? { width: meta.width, height: meta.height }
      : getRenderSize(format);

  // "fill" at the source's own aspect ratio is a straight upscale — never a
  // pad. Flatten first so transparent template pixels read as the black they
  // will composite to, which keeps band detection honest.
  let baseBuf = await sharp(templatePath)
    .flatten({ background: { r: 0, g: 0, b: 0 } })
    .resize(contentSize.width, contentSize.height, {
      fit: "fill",
      kernel: "lanczos3",
    })
    .png()
    .toBuffer();

  // Do NOT auto-smudge source art here — corner blur eats captions / panel art.
  // Logo removal for legacy AI gallery PNGs is a one-off scrub script.

  const srcRect = await resolveSourceArtRect(baseBuf, format);

  if (isGalleryPath(cleanBase) && !options.preserveBakedCaptions) {
    baseBuf = await smudgeBakedGalleryCaptions(baseBuf, format, srcRect);
  }

  // Full-bleed square: art covers every pixel that is not a deliberate band.
  const side = Math.max(contentSize.width, contentSize.height);
  const bandPlan = computeBandPlan(format, captions, {
    includeFooter: options.includeFooter !== false,
    side,
  });
  const composedBase = await composeFullBleedSquare(
    baseBuf,
    srcRect,
    side,
    bandPlan
  );
  return {
    baseBuf: composedBase.buf,
    artRect: composedBase.artRect,
    bandPlan,
    renderSize: { width: side, height: side },
    // Bands are planned, not pixel-detected: the canvas has no black left to
    // find except the bands we deliberately reserved.
    letterboxBounds: {
      topEndFrac: bandPlan.contentTop,
      bottomStartFrac: bandPlan.contentBottom,
    },
    renderFormat: mapFormatZonesToContent(
      format,
      bandPlan,
      composedBase.artRect
    ),
  };
}

export async function renderMeme(format, captions, options = {}) {
  await ensureFontsInstalled();

  let { baseBuf, renderSize, letterboxBounds, renderFormat } =
    await planFullBleedRender(format, captions, options);

  // Product decision: no LoL logo on teacher-shared images (customize + gallery).
  // Pass options.includeWatermark = true only for internal branded exports.
  const wantWatermark =
    options.includeWatermark === true && format.skipWatermark !== true;

  const placement = wantWatermark
    ? await resolveWatermarkPlacement(renderFormat, captions, renderSize, {
        letterboxBounds,
      })
    : null;

  const watermark = placement
    ? { corner: placement.corner, reservePx: placement.reservePx }
    : null;

  const svg = await buildSvgOverlay(
    renderFormat,
    captions,
    watermark,
    renderSize,
    false,
    false
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

  let composed = await sharp(baseBuf)
    .composite(composites)
    .png({ compressionLevel: 9, quality: 92 })
    .toBuffer();

  // Soft product loop footer (incite customize/share). Opt out with includeFooter: false.
  if (options.includeFooter !== false) {
    composed = await sharp(composed)
      .composite([
        {
          input: buildMemeLoopFooterSvg(
            renderSize.width,
            renderSize.height,
            MEME_LOOP_FOOTER_TEXT,
            letterboxBounds
          ),
          top: 0,
          left: 0,
          blend: "over",
        },
      ])
      .png({ compressionLevel: 9, quality: 92 })
      .toBuffer();
  }

  return composed;
}

/** True when planned caption ink overlaps the brand reserve (for tests). */
export function captionInkOverlapsBrandReserve(bbox, reserve) {
  return Boolean(bbox && reserve && rectsOverlapPx(bbox, reserve));
}

/**
 * Attribution line centered in the bottom black letterbox bar.
 */
export function buildMemeLoopFooterSvg(
  width,
  height,
  text = MEME_LOOP_FOOTER_TEXT,
  letterboxBounds = null
) {
  const { fontSize, bandTop, bandHeight, textY } = footerBandMetrics(
    width,
    height,
    letterboxBounds,
    text
  );

  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <rect x="0" y="${bandTop}" width="${width}" height="${bandHeight}" fill="#000000"/>
      <text x="${Math.round(
        width / 2
      )}" y="${textY}" text-anchor="middle" dominant-baseline="middle" font-family="${FOOTER_FONT}" font-size="${fontSize}" font-weight="600" fill="#ffffff" fill-opacity="0.78" letter-spacing="0.03em">${escXml(
      text
    )}</text>
    </svg>`
  );
}
