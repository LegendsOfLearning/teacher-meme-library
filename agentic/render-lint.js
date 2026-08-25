// Deterministic render lint — the code half of "code composes AND code checks".
//
// Everything the vision loop used to burn tokens on that is actually a
// geometry or fit question is answered here, in code, for $0: side pillar
// bars, unfilled zones, captions that cannot fit their zone, junk charset,
// over-budget caption lengths. The model is left with the one job code
// cannot do — judging whether the joke lands.
//
// Nothing in here is subjective. Every blocking item names a zone or an edge
// and is phrased as an instruction the writer can act on without seeing the
// image.
import sharp from "sharp";
import { getRenderSize, measureZoneFit } from "../app/lib/render.js";

// A pixel column counts as "bar" when nearly all of it is near-black.
const NEAR_BLACK = 20;
const COLUMN_BAR_RATIO = 0.85;
// Matches the critic rubric's letterboxing threshold (blocking #2).
const SIDE_BAR_BLOCKING_FRAC = 0.08;

// Zones the format's canon deliberately leaves empty. Side bars are never
// intentional; blank zones sometimes are, and only here.
const CANON_BLANK_ZONES = {
  "anakin-padme": ["p3"],
};

// Formats the orchestrator must not pick, because the square canvas costs them
// their structure. As of the full-bleed renderer (2026-08-25) NO format pillar-
// bars any more — art is cover-cropped to the edges instead of contain-padded —
// so this list is no longer about black bars. What survives it is the other
// failure the square frame can cause: a vertical multi-panel stack loses the
// top and bottom of its art to the crop, and the caption zones anchored to
// those panels get clamped to slivers.
//
// Measured, not guessed: render every format with its own exampleCaptions,
// compare each zone's mapped box against its declared box (planFullBleedRender
// in app/lib/render.js exposes both), and list the formats that keep under 50%
// of a zone. Re-measure when templates or zone geometry change.
//   two-buttons     — 0.66 aspect; the crop takes 40% of the height, the button
//                     panel is cut off at the top and the "person" label at the
//                     bottom is clamped to nothing (keeps 27% of its box).
//   expanding-brain — 0.71 aspect; brains 1 and 4 are cropped away, and their
//                     captions keep 46% / 39% of their boxes.
export const PILLARBOX_FORMAT_IDS = [
  "two-buttons",
  "expanding-brain",
];

function zoneIsOptional(format, zone) {
  if (zone.optional) return true;
  if ((CANON_BLANK_ZONES[format?.id] || []).includes(zone.key)) return true;
  return /optional/i.test(zone.label || "");
}

// Caption character budgets (from the v9 prompt): narrow panel zones vs
// full-width top/bottom bars. The renderer wraps past these, so they are
// notes, not blockers.
const NARROW_ZONE_CHARS = 28;
const FULL_WIDTH_ZONE_CHARS = 42;
const FULL_WIDTH_MIN_W = 0.8;

const ALLOWED_CHARS = /^[A-Za-z0-9 .,'!?"&%$#@:;()…\-—\n]*$/;

// The renderer always reserves a strip at the bottom for the brand watermark
// (FOOTER_BAND_MIN_FRAC in app/lib/render.js). That strip is required
// branding, never a defect.
const FOOTER_FRAC = 0.085;

/** Fraction of the canvas occupied by solid near-black pillars on each side. */
async function sideBarFractions(png) {
  const { data, info } = await sharp(png)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const isBarColumn = (x) => {
    let dark = 0;
    for (let y = 0; y < height; y += 1) {
      const i = (y * width + x) * channels;
      if (data[i] < NEAR_BLACK && data[i + 1] < NEAR_BLACK && data[i + 2] < NEAR_BLACK) {
        dark += 1;
      }
    }
    return dark / height >= COLUMN_BAR_RATIO;
  };
  const isBarRow = (y) => {
    let dark = 0;
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * channels;
      if (data[i] < NEAR_BLACK && data[i + 1] < NEAR_BLACK && data[i + 2] < NEAR_BLACK) {
        dark += 1;
      }
    }
    return dark / width >= COLUMN_BAR_RATIO;
  };
  let left = 0;
  while (left < width && isBarColumn(left)) left += 1;
  let right = 0;
  while (right < width - left && isBarColumn(width - 1 - right)) right += 1;
  let top = 0;
  while (top < height && isBarRow(top)) top += 1;
  let bottom = 0;
  while (bottom < height - top && isBarRow(height - 1 - bottom)) bottom += 1;
  return {
    leftFrac: left / width,
    rightFrac: right / width,
    topFrac: top / height,
    bottomFrac: bottom / height,
    width,
    height,
  };
}

/** Does the format put a caption INTO the black band on this edge? */
function hasLetterboxCaption(format, captions, edge) {
  return (format?.zones || []).some(
    (z) =>
      z.placeInLetterbox === edge &&
      captions?.[z.key] != null &&
      String(captions[z.key]).trim() !== ""
  );
}

function isFullWidthZone(zone) {
  return (zone.w ?? 0) >= FULL_WIDTH_MIN_W;
}

/**
 * Lint one rendered meme entirely in code.
 * @param {object} args {png: Buffer, format: object, captions: object}
 * @returns {Promise<{ok: boolean, blocking: string[], notes: string[], metrics: object}>}
 */
export async function lintRender({ png, format, captions = {} }) {
  const blocking = [];
  const notes = [];
  const metrics = { zones: {} };

  // --- 1. Side pillar bars. The renderer is full-bleed and pads nothing, so
  // this is now a regression guard rather than a filter: it should never fire.
  // If it does, geometry broke in app/lib/render.js — do not fix it by
  // rewriting captions.
  if (png) {
    const bars = await sideBarFractions(png);
    metrics.leftFrac = Number(bars.leftFrac.toFixed(4));
    metrics.rightFrac = Number(bars.rightFrac.toFixed(4));
    metrics.canvas = `${bars.width}x${bars.height}`;
    for (const [side, frac] of [
      ["left", bars.leftFrac],
      ["right", bars.rightFrac],
    ]) {
      if (frac >= SIDE_BAR_BLOCKING_FRAC) {
        blocking.push(
          `Renderer left a solid bar on the ${side} edge covering ${(frac * 100).toFixed(0)}% of the canvas width. The renderer is full-bleed and should never pad a side — this is a geometry regression in app/lib/render.js, not something a caption rewrite can fix.`
        );
      } else if (frac > 0.01) {
        notes.push(`minor ${side} pillar bar: ${(frac * 100).toFixed(1)}% of width`);
      }
    }

    // Top/bottom bands are measured but NEVER blocking. Under the full-bleed
    // renderer every remaining band is deliberate: a caption letterbox the
    // format asked for (placeInLetterbox) or the brand footer strip. Anything
    // else showing up here means the renderer padded, which is a geometry bug,
    // so it stays recorded in the trace rather than aimed at the writer.
    metrics.topFrac = Number(bars.topFrac.toFixed(4));
    metrics.bottomFrac = Number(bars.bottomFrac.toFixed(4));
    const topPad = hasLetterboxCaption(format, captions, "top") ? 0 : bars.topFrac;
    const bottomPad = hasLetterboxCaption(format, captions, "bottom")
      ? 0
      : Math.max(0, bars.bottomFrac - FOOTER_FRAC);
    for (const [edge, frac] of [
      ["top", topPad],
      ["bottom", bottomPad],
    ]) {
      if (frac >= SIDE_BAR_BLOCKING_FRAC) {
        notes.push(
          `unexpected black band on the ${edge} edge over ${(frac * 100).toFixed(
            0
          )}% of canvas height with no caption in it — the full-bleed renderer should not have produced this`
        );
      }
    }
  }

  const zones = (format?.zones || []).filter((z) => !z.decorative);
  const blankOk = new Set(CANON_BLANK_ZONES[format?.id] || []);
  const { width: imgW, height: imgH } = getRenderSize(format);

  // --- 2. Zone coverage
  for (const zone of zones) {
    const raw = captions?.[zone.key];
    const filled = raw != null && String(raw).trim() !== "";
    if (filled) continue;
    if (blankOk.has(zone.key)) {
      notes.push(`${zone.key} left blank (canonical silence) — correct`);
      continue;
    }
    if (zoneIsOptional(format, zone)) {
      notes.push(`${zone.key} is optional and was left empty`);
      continue;
    }
    blocking.push(
      `Zone "${zone.key}" (${zone.label || "unlabeled"}) has no caption. Every declared zone of this format must carry text or the gag is structurally incomplete.`
    );
  }

  // --- 3. Caption fit (the renderer's own fit math, no rendering needed)
  for (const zone of zones) {
    const raw = captions?.[zone.key];
    if (raw == null || String(raw).trim() === "") continue;
    const fit = measureZoneFit(zone, raw, imgW, imgH);
    if (!fit) continue;
    const widest = Math.max(...fit.lines.map((l) => l.length), 1);
    const widthUsed = widest * fit.charWidth * fit.fs;
    const heightUsed =
      fit.lines.length > 1 ? fit.lines.length * fit.lineHeight : fit.fs;
    metrics.zones[zone.key] = {
      chars: String(raw).trim().length,
      fs: fit.fs,
      lines: fit.lines.length,
      maxLines: fit.maxLines,
      widthUsedFrac: Number((widthUsed / fit.boxW).toFixed(3)),
    };

    if (fit.lines.length > fit.maxLines) {
      blocking.push(
        `Zone "${zone.key}" needs ${fit.lines.length} lines but the zone allows ${fit.maxLines}. Cut it to about ${Math.round(
          (String(raw).trim().length * fit.maxLines) / fit.lines.length
        )} characters.`
      );
      continue;
    }
    // Readability floor (reviewer feedback 2026-08-25: copy kept shrinking to
    // fit): below 3% of canvas height a caption is mush at thumbnail size.
    const readableMinFs = Math.max(fit.absoluteFloorFs, imgH * 0.03);
    if (fit.fs <= readableMinFs) {
      blocking.push(
        `Zone "${zone.key}" only fits at ${fit.fs}px, below the readable floor (${Math.round(
          readableMinFs
        )}px) — it will be unreadable at thumbnail size. Cut it to roughly ${Math.max(
          10,
          Math.round(String(raw).trim().length * 0.6)
        )} characters.`
      );
      continue;
    }
    // Overflow messages carry a character target, not a pixel count: the
    // writer cannot see pixels, and "shorten it" without a number produced
    // revisions that overflowed again.
    const charTarget = (ratio) =>
      Math.max(6, Math.floor(String(raw).trim().length * ratio * 0.95));
    if (widthUsed > fit.boxW * 1.06) {
      blocking.push(
        `Zone "${zone.key}" is too long for its box — rewrite it in at most ${charTarget(
          fit.boxW / widthUsed
        )} characters (it is ${String(raw).trim().length} now).`
      );
      continue;
    }
    if (heightUsed > fit.boxH * 1.06) {
      blocking.push(
        `Zone "${zone.key}" is too tall for its box — rewrite it in at most ${charTarget(
          fit.boxH / heightUsed
        )} characters (it is ${String(raw).trim().length} now).`
      );
      continue;
    }

    // --- 5. Length budgets (renderer wraps, so: notes)
    const budget = isFullWidthZone(zone) ? FULL_WIDTH_ZONE_CHARS : NARROW_ZONE_CHARS;
    const len = String(raw).trim().length;
    if (len > budget) {
      notes.push(
        `${zone.key} is ${len} chars (budget ~${budget}); it wrapped to ${fit.lines.length} line(s) at ${fit.fs}px`
      );
    }
  }

  // Parallel zones (same maxLines, comparable width) reading with mismatched
  // line counts is the "sloppy set" defect the vision loop used to catch.
  const lineCounts = Object.values(metrics.zones).map((z) => z.lines);
  if (lineCounts.length > 1 && new Set(lineCounts).size > 1) {
    notes.push(
      `mixed line counts across zones (${Object.entries(metrics.zones)
        .map(([k, z]) => `${k}=${z.lines}`)
        .join(" ")}) — matched line counts look more deliberate`
    );
  }

  // --- 4. Charset
  for (const [key, raw] of Object.entries(captions || {})) {
    const text = String(raw ?? "");
    if (!text.trim()) continue;
    if (!ALLOWED_CHARS.test(text)) {
      const bad = [...new Set([...text].filter((c) => !ALLOWED_CHARS.test(c)))];
      notes.push(
        `${key} contains characters outside the meme-safe set: ${bad.join(" ")} — the bundled fonts may render them as artifacts`
      );
    }
    if ((text.match(/"/g) || []).length % 2 !== 0) {
      notes.push(`${key} has an unbalanced double quote`);
    }
  }

  // --- 6. Banned cadence (reviewer mandate, 2026-08-25): the worn-out
  // "confident plan → hopeful question" skeleton. Deterministic because the
  // writer models keep reaching for it despite the prompt.
  for (const [key, raw] of Object.entries(captions || {})) {
    const text = String(raw ?? "").trim();
    if (!text) continue;
    if (/\bright\s*[?!]+$/i.test(text) || /what could possibly go wrong/i.test(text)) {
      blocking.push(
        `${key} ends on the banned hopeful-question cadence ("...right?" / "what could possibly go wrong"). Rewrite the punchline as a concrete outcome or specific moment, not a rhetorical question.`
      );
    }
  }

  return { ok: blocking.length === 0, blocking, notes, metrics };
}

export default lintRender;
