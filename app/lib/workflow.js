// ─── Multi-step agentic meme workflow ──────────────────────────────────────
//
// This module implements the brief's required pipeline:
//
//   1. Choose the right meme format for the situation (or honor user pick).
//   2. Verify the template exists / fits the situation. (Implicit retry.)
//   3. Generate 10 caption candidates filling the format's text zones.
//   4. Score each candidate on funniness, relatability, clarity, brand
//      safety, and shareability.
//   5. Pick the highest-scoring caption that passes brand safety.
//   6. Render the final meme via lib/render.
//   7. Run an adversarial review against a stricter K-8 brand bar.
//   8. If review fails: roll back to the next-best caption and re-render.
//   9. Save permanently with a public share URL.
//
// Each step is intentionally a pure function so the pipeline is
// modular and testable. All steps emit structured events into a
// `trace` array we save with the meme — the share page can later
// surface "agentic build steps" if we want.
//
// Fallback: the LLM steps degrade gracefully to baked-in
// `exampleCaptions` when no API key is configured, so the prototype
// is fully usable offline.

import {
  memeFormats,
  getFormatById,
  pickFormatForSituation,
  captionSchemaFor,
  maxCharsForZone,
} from "./meme-formats";
import {
  getSituationById,
  getToneById,
} from "./content";
import { callJSON, llmConfigured } from "./llm";
import { findBlockedTerm, BLOCKLIST_USER_MESSAGE } from "./blocklist";
import { describeBlock, moderateText } from "./moderation";
import {
  failClosedOnModerationSkip,
  saveBlockedWithoutApi,
  MODERATION_NOT_CONFIGURED_MESSAGE,
  MODERATION_UNAVAILABLE_MESSAGE,
} from "./moderation-policy";
import { renderMeme } from "./render";
import { newMemeId, saveMeme } from "./storage";

// Minimum aggregate score (0-10) we accept from the picker.
// Anything lower and we ask the LLM again or fall back.
const MIN_SCORE = 6.0;

// ─── Step 1: pick a format ────────────────────────────────────────────────
function step1_pickFormat({ situationId, formatId, excludeIds }) {
  let format = null;
  let reason = "";
  if (formatId && formatId !== "auto") {
    format = getFormatById(formatId);
    reason = format ? "user-selected" : "user-selected-not-found";
  }
  if (!format) {
    format = pickFormatForSituation(situationId, excludeIds);
    reason = format ? "matched-by-situation" : "no-match";
  }
  if (!format) {
    format = memeFormats[Math.floor(Math.random() * memeFormats.length)];
    reason = "random-fallback";
  }
  return {
    format,
    event: {
      step: 1,
      name: "pick_format",
      reason,
      formatId: format.id,
    },
  };
}

// ─── Step 2/3: confirm template (no-op for prototype) ────────────────────
//
// In a richer system this would render a low-res preview and ask the
// model "does this image fit the situation?". For the prototype the
// SITUATION_TO_FORMATS map already encodes that mapping, so we treat
// every curated template as situation-appropriate.
function step2_confirmTemplate(format, situation) {
  return {
    ok: true,
    event: { step: 2, name: "confirm_template", formatId: format.id },
  };
}

// ─── Step 4: generate caption candidates ─────────────────────────────────
function buildCaptionPrompt({ format, situation, tone, n }) {
  const schema = captionSchemaFor(format);
  const schemaLines = Object.entries(schema)
    .map(([k, label]) => `  - "${k}": ${label}`)
    .join("\n");

  // Show up to 5 gold-standard examples — more reference points
  // help the LLM internalize the tightness and structure these
  // formats demand. Capped at 5 so the prompt stays fast.
  const examples = (format.exampleCaptions || [])
    .slice(0, 5)
    .map((c) => "  " + JSON.stringify(c))
    .join("\n");

  const structureBlock = format.jokeStructure
    ? `\n\nFORMAT-SPECIFIC JOKE STRUCTURE — every caption you write MUST follow this:\n${format.jokeStructure}`
    : "";

  const system = `You are a senior comedy writer for a K-8 education brand called Legends of Learning. You write meme captions that ACTUAL TEACHERS will screenshot and send to their group chat with "literally me 😭".

You are writing for the meme format: ${format.name}.
Format vibe: ${format.description}

Your job: produce ${n} DISTINCT caption options for this format. Each option is a JSON object with these fields:
${schemaLines}

GOLD-STANDARD QUALITY BAR — these are real captions from this exact format that have gone viral with teachers. EVERY caption you write MUST be as tight and as funny as these. Match their punchiness and structure. Do not copy them verbatim, but write captions that would slot into this set seamlessly:
${examples || "  (none)"}${structureBlock}

WHAT MAKES THESE CAPTIONS GREAT (study this and replicate it):
- They are SHORT. 3-7 words per zone is the target. The viral examples above average ~5 words. 10+ words is almost always a fail.
- They name a SINGLE, universally-recognized moment from teaching life — not a hyper-specific niche scenario. Universal beats specific. "I had a plan / They had other plans" works for every teacher in America.
- For two-panel formats (Drake, Grumpy Cat, Success Kid, Disaster Girl, etc.) BOTH panels describe the SAME situation from two angles. Same subject, sharp contrast. Don't put unrelated scenarios in the two panels.
- The joke is the GAP between expectation and reality, or between what was said and what actually happens.
- They use plain teacher vocabulary: lesson plan, sub plans, fire drill, copier, anchor chart, IEP, exit ticket, hall pass, PD, Friday afternoon, indoor recess, the email chain, the gradebook, "see me", "almost done".
- They never write "WHEN YOU…", "ME WHEN…", or "POV:". Just state the thing.

Hard rules:
- Each value: 3-7 words. Never more than 10. Shorter is funnier.
- All ${n} options must be DISTINCT — different jokes, different angles. No paraphrases of each other.
- Strictly school-safe for a K-8 brand. No profanity, slurs, sexual / drug / violence / self-harm content, no identifiable real students / teachers / admins, no political content.
- Punch UP at the system / the day / your own coping mechanisms. NEVER punch DOWN at kids.
- ALL CAPS isn't required — the renderer applies formatting.

Output: STRICT JSON of shape {"captions": [ {...zone keys...}, {...}, ... ]} with exactly ${n} items. No prose.`;

  const user = `Teacher situation: ${situation.label} — ${situation.blurb}
Tone: ${tone.label}. ${tone.instruction}

Write ${n} different caption options for the "${format.name}" meme that nail this situation in this tone.`;

  return { system, user };
}

async function step4_generateCaptions({ format, situation, tone, n = 10 }) {
  const event = {
    step: 4,
    name: "generate_captions",
    formatId: format.id,
    n,
    source: "llm",
  };

  if (!llmConfigured()) {
    // Offline fallback: shuffle the baked-in examples.
    const examples = [...(format.exampleCaptions || [])];
    for (let i = examples.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [examples[i], examples[j]] = [examples[j], examples[i]];
    }
    return {
      candidates: examples.slice(0, n),
      event: { ...event, source: "baked-in", count: examples.length },
    };
  }

  const { system, user } = buildCaptionPrompt({ format, situation, tone, n });
  let parsed;
  try {
    parsed = await callJSON({
      system,
      user,
      temperature: 0.95,
      maxTokens: 900,
    });
  } catch (e) {
    return {
      candidates: format.exampleCaptions || [],
      event: { ...event, source: "baked-in-after-error", error: e.message },
    };
  }

  const captions = Array.isArray(parsed?.captions) ? parsed.captions : [];
  // Keep only objects that fill at least one zone with a string.
  const initiallyCleaned = captions.filter(
    (c) =>
      c &&
      typeof c === "object" &&
      Object.values(c).some((v) => typeof v === "string" && v.trim() !== "")
  );

  // HARD LENGTH FILTER on LLM output. Each format zone has a
  // physical character budget (computed from its pixel dimensions
  // in meme-formats.js). Captions that overflow render as tiny
  // squished text — the #1 visual quality complaint. Drop them.
  //
  // Hand-curated `exampleCaptions` (the fallback path) are exempt:
  // they're already tuned and serve as the offline floor.
  const overflows = (c) =>
    format.zones.some((z) => {
      if (z.decorative) return false;
      const val = c?.[z.key];
      if (typeof val !== "string") return false;
      const budget = maxCharsForZone(format, z);
      return val.length > budget;
    });
  let cleaned = initiallyCleaned.filter((c) => !overflows(c));
  const droppedForLength = initiallyCleaned.length - cleaned.length;

  // Safety net: if EVERY LLM candidate overflowed, keep the shortest
  // of the LLM responses so we don't reject the whole batch over a
  // borderline budget call. Better a slightly tight caption than the
  // user seeing no funnier-than-baked-in output.
  if (cleaned.length === 0 && initiallyCleaned.length > 0) {
    const flatLen = (c) =>
      Object.values(c)
        .filter((v) => typeof v === "string")
        .reduce((sum, v) => sum + v.length, 0);
    initiallyCleaned.sort((a, b) => flatLen(a) - flatLen(b));
    cleaned = [initiallyCleaned[0]];
  }

  // Top up with curated examples if we still have fewer than asked.
  if (cleaned.length < n) {
    for (const ex of format.exampleCaptions || []) {
      if (cleaned.length >= n) break;
      cleaned.push(ex);
    }
  }
  return {
    candidates: cleaned,
    event: {
      ...event,
      count: cleaned.length,
      droppedForLength,
    },
  };
}

// ─── Step 5: score each candidate ────────────────────────────────────────
async function step5_scoreCaptions({ candidates, format, situation, tone }) {
  const event = {
    step: 5,
    name: "score_captions",
    count: candidates.length,
    source: "llm",
  };

  // Heuristic baseline scores (used both as offline fallback AND as a
  // sanity floor we layer onto the LLM scores).
  const heuristic = candidates.map((c) => {
    const all = Object.values(c).filter(Boolean).join(" ");
    const wordCount = all.split(/\s+/).filter(Boolean).length;
    // Penalize 0 words and >24 words (too long for a meme).
    let lengthScore = 8;
    if (wordCount === 0) lengthScore = 0;
    else if (wordCount > 24) lengthScore = 4;
    else if (wordCount > 18) lengthScore = 6;
    // Penalize blocklisted terms.
    const blocked = findBlockedTerm(all);
    const safety = blocked ? 0 : 8;
    return {
      funniness: 6.5,
      relatability: 7,
      clarity: lengthScore,
      brandSafety: safety,
      shareability: 6.5,
      total: (6.5 + 7 + lengthScore + safety + 6.5) / 5,
      _heuristic: true,
    };
  });

  if (!llmConfigured()) {
    return {
      scores: heuristic,
      event: { ...event, source: "heuristic" },
    };
  }

  const system = `You are a strict, honest comedy editor for an EDUCATION brand. You score teacher meme captions on 5 dimensions, each 0-10. Most captions are mediocre — your job is to find the one or two that are actually great and rank them above the safe filler.

Dimensions:
1. funniness        — would a real teacher physically laugh, not just nod? Reserve 9-10 for captions that surprised you.
2. relatability     — does it nail a SPECIFIC, observable moment of teaching life (vs. a generic abstraction)?
3. clarity          — is it instantly readable in meme format? Concise (4-10 words per zone), no "when you..." preamble.
4. brandSafety      — 10 = obviously fine for K-8 brand; 0 = inappropriate, profane, political, references real students, etc.
5. shareability     — would a teacher screenshot this in 5 seconds and send to their group chat with "ACCURATE"?

CALIBRATION (be honest, NOT generous):
- A safe, generic caption (e.g. "students never listen") = funniness 4, relatability 5, shareability 4.
- A specific, true-but-not-funny observation = funniness 5-6.
- A specific observation with a clever twist or surprising angle = funniness 7-8.
- A caption that genuinely made you smile and feels like an inside joke teachers share = 9.
- 10 = the screenshot lives on the staff room fridge.
- DIFFERENTIATE — at least 2 points of spread between best and worst. If all your scores are within 1 point, you are scoring wrong.
- LENGTH PENALTY: if any zone is over 10 words, drop CLARITY by 3 and SHAREABILITY by 2. Long captions kill memes — they don't fit the visual rhythm.
- Two-panel formats: if the two panels describe UNRELATED scenarios (different subjects, no contrast), drop FUNNINESS by 2. The joke depends on a single situation seen two ways.
- Brand safety should be 10 unless something is actually risky — don't dock it for being "edgy".

Return STRICT JSON: { "scores": [ {"funniness":..,"relatability":..,"clarity":..,"brandSafety":..,"shareability":..}, ... ] } in the same order as the inputs. No prose.`;

  const user = `Format: ${format.name} — ${format.description}
Situation: ${situation.label}. ${situation.blurb}
Tone: ${tone.label}.

Score these ${candidates.length} candidates IN ORDER:
${candidates.map((c, i) => `${i + 1}. ${JSON.stringify(c)}`).join("\n")}`;

  let parsed;
  try {
    parsed = await callJSON({
      system,
      user,
      temperature: 0.2,
      maxTokens: 800,
    });
  } catch (e) {
    return {
      scores: heuristic,
      event: { ...event, source: "heuristic-after-error", error: e.message },
    };
  }

  const llmScores = Array.isArray(parsed?.scores) ? parsed.scores : [];
  const merged = candidates.map((_, i) => {
    const s = llmScores[i] || {};
    const fun = Number(s.funniness) || 5;
    const rel = Number(s.relatability) || 5;
    const cla = Number(s.clarity) || 5;
    const bra = Number(s.brandSafety) || 5;
    const sha = Number(s.shareability) || 5;
    // Heuristic safety floor: if blocklist hit, force brandSafety to 0.
    const safetyFloor = heuristic[i].brandSafety === 0 ? 0 : bra;
    const total = (fun + rel + cla + safetyFloor + sha) / 5;
    return {
      funniness: fun,
      relatability: rel,
      clarity: cla,
      brandSafety: safetyFloor,
      shareability: sha,
      total,
    };
  });

  return { scores: merged, event };
}

// ─── Step 6: pick best ───────────────────────────────────────────────────
function step6_pickBest({ candidates, scores, excludeIndexes = [] }) {
  // Sort indexes by total score, descending. Tie-break on funniness.
  const indexes = candidates.map((_, i) => i).filter((i) => !excludeIndexes.includes(i));
  indexes.sort((a, b) => {
    const sa = scores[a];
    const sb = scores[b];
    if (sb.total !== sa.total) return sb.total - sa.total;
    return sb.funniness - sa.funniness;
  });

  // Prefer first that meets MIN_SCORE and has brandSafety >= 7.
  const passes = indexes.find(
    (i) => scores[i].total >= MIN_SCORE && scores[i].brandSafety >= 7
  );
  const idx = passes != null ? passes : indexes[0];
  return {
    idx,
    candidate: candidates[idx],
    score: scores[idx],
    event: {
      step: 6,
      name: "pick_best",
      idx,
      score: scores[idx],
      considered: indexes.length,
    },
  };
}

// ─── Step 7: render meme ─────────────────────────────────────────────────
async function step7_render({ format, captions, sourceFile }) {
  const png = await renderMeme(format, captions, { sourceFile });
  return {
    png,
    event: { step: 7, name: "render", bytes: png.length },
  };
}

// ─── Step 8: adversarial brand review ────────────────────────────────────
//
// Stricter than the regular safety screen. Specifically looks for:
//   - inappropriate language
//   - offensive stereotypes
//   - political content
//   - adult content
//   - unsafe student references
//   - brand risk
//   - copyright risk
//   - anything inappropriate for a K-8 education brand
async function step8_adversarialReview({ candidates, idx }) {
  const event = { step: 8, name: "adversarial_review", idx };
  const c = candidates[idx];
  const flat = Object.values(c).filter(Boolean).join("\n");

  // Layer A: blocklist (cheap, catches the obvious bypasses).
  const blocked = findBlockedTerm(flat);
  if (blocked) {
    return { ok: false, reason: "blocklist", term: blocked, event: { ...event, ok: false, blocked } };
  }

  // Layer B: OpenAI moderation (if configured).
  const mod = await moderateText(flat);
  if (!mod.ok) {
    return {
      ok: false,
      reason: mod.category === "moderation_unavailable" ? "moderation_unavailable" : "moderation",
      category: mod.category,
      message: mod.message || describeBlock(mod),
      event: { ...event, ok: false, category: mod.category },
    };
  }
  if (mod.skipped && failClosedOnModerationSkip()) {
    return {
      ok: false,
      reason: "moderation_unavailable",
      message: mod.message || MODERATION_UNAVAILABLE_MESSAGE,
      event: { ...event, ok: false, skipped: mod.reason },
    };
  }

  // Layer C: stricter LLM-based brand review (skipped if no API key).
  if (!llmConfigured()) {
    if (failClosedOnModerationSkip()) {
      return {
        ok: false,
        reason: "moderation_unavailable",
        message: MODERATION_UNAVAILABLE_MESSAGE,
        event: { ...event, ok: false, source: "no-llm" },
      };
    }
    return { ok: true, event: { ...event, ok: true, source: "no-llm" } };
  }

  const system = `You are the K-8 brand safety reviewer for Legends of Learning. You review final meme captions before they ship.

Reject if ANY of the following is true (even mild):
- Profanity, slurs, sexual or drug references, violence, self-harm jokes
- Offensive or "punching down" stereotypes (race, gender, disability, class, religion, body)
- Political content (parties, politicians, hot-button issues)
- Adult / suggestive content
- Identifiable real students, teachers, administrators, parents, or schools
- Mockery of children or learners themselves (we punch UP at the system, not at kids)
- Brand or copyright risk (real product names, brands the teacher is "endorsing", etc.)
- Anything a K-8 principal would flinch at sharing in a staff newsletter

Output STRICT JSON: { "ok": true } if the caption is safe to ship. { "ok": false, "reason": "<one short reason>" } otherwise.`;

  const user = `Caption JSON to review: ${JSON.stringify(c)}`;

  let parsed;
  try {
    parsed = await callJSON({
      system,
      user,
      temperature: 0,
      maxTokens: 80,
    });
  } catch (e) {
    if (failClosedOnModerationSkip()) {
      return {
        ok: false,
        reason: "moderation_unavailable",
        message: MODERATION_UNAVAILABLE_MESSAGE,
        event: { ...event, ok: false, error: e.message, source: "fallback" },
      };
    }
    return { ok: true, event: { ...event, ok: true, error: e.message, source: "fallback" } };
  }

  if (parsed?.ok) {
    return { ok: true, event: { ...event, ok: true, source: "llm" } };
  }
  return {
    ok: false,
    reason: "brand_review",
    message: parsed?.reason || "Failed brand review",
    event: { ...event, ok: false, llmReason: parsed?.reason },
  };
}

// ─── Validate user-supplied caption (Edit / manual mode) ─────────────────
export async function validateUserCaptions(format, captions) {
  if (saveBlockedWithoutApi()) {
    return {
      ok: false,
      reason: "not_configured",
      message: MODERATION_NOT_CONFIGURED_MESSAGE,
    };
  }

  const flat = Object.values(captions || {})
    .filter(Boolean)
    .join("\n");
  if (!flat.trim()) {
    return { ok: false, reason: "empty", message: "Add at least one caption." };
  }
  for (const z of format.zones) {
    if (z.decorative) continue;
    const val = captions[z.key];
    if (typeof val !== "string" || !val.trim()) continue;
    const budget = maxCharsForZone(format, z);
    if (val.length > budget) {
      return {
        ok: false,
        reason: "too_long",
        message: `"${z.label}" is too long — keep it under ${budget} characters so it fits on the meme.`,
      };
    }
  }
  const blocked = findBlockedTerm(flat);
  if (blocked) {
    return {
      ok: false,
      reason: "blocklist",
      message: BLOCKLIST_USER_MESSAGE,
    };
  }
  const mod = await moderateText(flat);
  if (!mod.ok) {
    return {
      ok: false,
      reason: mod.category === "moderation_unavailable" ? "moderation_unavailable" : "moderation",
      message:
        mod.message ||
        describeBlock(mod) ||
        "This caption doesn't meet our community guidelines.",
    };
  }
  if (mod.skipped && failClosedOnModerationSkip()) {
    return {
      ok: false,
      reason: "moderation_unavailable",
      message: mod.message || MODERATION_UNAVAILABLE_MESSAGE,
    };
  }
  return { ok: true };
}

// ─── Top-level pipeline ──────────────────────────────────────────────────

/**
 * Generate a brand-safe, funny teacher meme for the given inputs.
 *
 * @param {object} args
 * @param {string} args.situationId   One of the situations in content.js.
 * @param {string} args.toneId        One of the tones in content.js.
 * @param {string} [args.formatId]    Specific meme format, or "auto".
 * @param {object} [args.userCaptions] Optional pre-filled captions
 *                                     (Edit mode). Skips steps 4-6.
 * @param {string[]} [args.excludeFormatIds] Used by "regenerate" to avoid
 *                                     repicking the same format.
 * @returns {Promise<object>} saved meme record (id, pngUrl, sharePath, ...).
 */
export async function generateMeme({
  situationId,
  toneId,
  formatId,
  userCaptions,
  excludeFormatIds = [],
  sourceFile,
}) {
  const trace = [];
  const situation =
    getSituationById(situationId) || {
      id: "unknown",
      label: "Teaching life",
      blurb: "general teacher chaos",
    };
  const tone =
    getToneById(toneId) || {
      id: "relatable",
      label: "Relatable",
      instruction: "Warm, true-to-life teacher humor.",
    };

  // ── Step 1
  const s1 = step1_pickFormat({
    situationId,
    formatId,
    excludeIds: excludeFormatIds,
  });
  const format = s1.format;
  trace.push(s1.event);

  // ── Step 2/3
  const s2 = step2_confirmTemplate(format, situation);
  trace.push(s2.event);

  let chosen, chosenScore, chosenIdx, candidates, scores;

  if (userCaptions) {
    // Edit/manual mode — single candidate, but still passes adversarial.
    candidates = [userCaptions];
    scores = [
      {
        funniness: 7,
        relatability: 7,
        clarity: 7,
        brandSafety: 8,
        shareability: 7,
        total: 7.2,
      },
    ];
    chosen = userCaptions;
    chosenScore = scores[0];
    chosenIdx = 0;
    trace.push({ step: 4, name: "user_supplied_captions" });
  } else {
    // ── Step 4
    const s4 = await step4_generateCaptions({ format, situation, tone, n: 10 });
    candidates = s4.candidates;
    trace.push(s4.event);

    if (candidates.length === 0) {
      const err = new Error("Could not generate any caption candidates.");
      err.code = "NO_CANDIDATES";
      throw err;
    }

    // ── Step 5
    const s5 = await step5_scoreCaptions({ candidates, format, situation, tone });
    scores = s5.scores;
    trace.push(s5.event);

    // ── Step 6
    const s6 = step6_pickBest({ candidates, scores });
    chosen = s6.candidate;
    chosenScore = s6.score;
    chosenIdx = s6.idx;
    trace.push(s6.event);
  }

  // ── Step 7 (render — we always render the chosen caption first; if
  //    Step 8 vetoes it we discard and re-render the next-best.)
  let png;
  let attempts = 0;
  const triedIdx = new Set();
  while (true) {
    attempts++;
    triedIdx.add(chosenIdx);

    const s7 = await step7_render({ format, captions: chosen, sourceFile });
    png = s7.png;
    trace.push(s7.event);

    // ── Step 8
    const s8 = await step8_adversarialReview({ candidates, idx: chosenIdx });
    trace.push(s8.event);

    if (s8.ok) break;

    // Step 8 vetoed. Either roll back to the next-best candidate, or
    // bail with a friendly error.
    if (userCaptions) {
      const err = new Error(
        s8.message ||
          "This caption didn't pass our brand review. Try editing it."
      );
      err.code = "ADVERSARIAL_VETO";
      throw err;
    }

    const remainingIdxs = candidates
      .map((_, i) => i)
      .filter((i) => !triedIdx.has(i));
    if (remainingIdxs.length === 0 || attempts >= 5) {
      const err = new Error(
        "We couldn't find a brand-safe funny caption this time. Try a different tone or format."
      );
      err.code = "ADVERSARIAL_VETO_ALL";
      throw err;
    }

    // Pick next-best of the remaining.
    const next = step6_pickBest({
      candidates,
      scores,
      excludeIndexes: Array.from(triedIdx),
    });
    chosen = next.candidate;
    chosenScore = next.score;
    chosenIdx = next.idx;
    trace.push({ step: 6.5, name: "fallback_pick", idx: chosenIdx });
  }

  // ── Step 9: persist
  const id = newMemeId();
  const record = await saveMeme({
    id,
    pngBuffer: png,
    format,
    captions: chosen,
    meta: {
      situationId: situation.id,
      situationLabel: situation.label,
      toneId: tone.id,
      toneLabel: tone.label,
      score: chosenScore,
      trace,
      candidatesCount: candidates.length,
      attempts,
    },
  });
  trace.push({ step: 9, name: "save", id });

  return record;
}
