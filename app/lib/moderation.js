// Server-side helpers around OpenAI's omni-moderation API.
// Used as a second-line defense after the blocklist.
// Educational context => stricter thresholds than OpenAI's defaults.

import {
  moderationRequired,
  MODERATION_UNAVAILABLE_MESSAGE,
} from "./moderation-policy.js";

const MODERATION_URL = "https://api.openai.com/v1/moderations";
const MODERATION_MODEL = "omni-moderation-latest";

// Score above which we treat a category as a hit, even if `flagged` is false.
// 0.4 is meaningfully stricter than OpenAI's internal threshold.
const STRICT_SCORE = 0.4;

// Auto-block categories: if `flagged` is true OR `category_scores[cat] > STRICT_SCORE`,
// we reject. Educational context => everything sensitive is in here.
const SENSITIVE_CATEGORIES = [
  "sexual",
  "sexual/minors",
  "harassment",
  "harassment/threatening",
  "hate",
  "hate/threatening",
  "self-harm",
  "self-harm/intent",
  "self-harm/instructions",
  "violence",
  "violence/graphic",
  "illicit",
  "illicit/violent",
];

function pickStrongestCategory(result) {
  if (!result || !result.category_scores) return null;
  let best = null;
  for (const cat of SENSITIVE_CATEGORIES) {
    const score = result.category_scores[cat];
    if (typeof score === "number" && (!best || score > best.score)) {
      best = { category: cat, score };
    }
  }
  return best;
}

function evaluateResult(result) {
  if (!result) {
    return { ok: true, reason: null, category: null, score: 0 };
  }
  const categories = result.categories || {};
  const scores = result.category_scores || {};

  // Hard block any of OpenAI's flags.
  if (result.flagged) {
    const strongest = pickStrongestCategory(result);
    return {
      ok: false,
      reason: "flagged",
      category: strongest?.category || "unknown",
      score: strongest?.score || 1,
    };
  }

  // Educational-context strict threshold.
  for (const cat of SENSITIVE_CATEGORIES) {
    if (categories[cat] === true) {
      return {
        ok: false,
        reason: "category",
        category: cat,
        score: scores[cat] || 1,
      };
    }
    const score = scores[cat];
    if (typeof score === "number" && score > STRICT_SCORE) {
      return { ok: false, reason: "score", category: cat, score };
    }
  }

  return { ok: true, reason: null, category: null, score: 0 };
}

function unavailableResult(reason, extra = {}) {
  if (moderationRequired()) {
    return {
      ok: false,
      skipped: true,
      reason,
      category: "moderation_unavailable",
      score: 0,
      message: MODERATION_UNAVAILABLE_MESSAGE,
      ...extra,
    };
  }
  return {
    ok: true,
    skipped: true,
    reason,
    category: null,
    score: 0,
    ...extra,
  };
}

async function callModeration(input) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return unavailableResult("no_api_key");
  }

  let response;
  try {
    response = await fetch(MODERATION_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model: MODERATION_MODEL, input }),
    });
  } catch (err) {
    return unavailableResult("network_error", { error: err?.message });
  }

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    return unavailableResult("api_error", {
      error: `HTTP ${response.status}: ${text.slice(0, 200)}`,
    });
  }

  const data = await response.json();
  const result = data?.results?.[0];
  return evaluateResult(result);
}

export async function moderateText(text) {
  if (!text || !String(text).trim()) {
    return { ok: true, reason: null, category: null, score: 0 };
  }
  return callModeration(String(text));
}

/**
 * @param {string} dataUrlOrUrl - data:image/...;base64,... or https URL
 */
export async function moderateImage(dataUrlOrUrl) {
  if (!dataUrlOrUrl) {
    return { ok: true, reason: null, category: null, score: 0 };
  }
  return callModeration([
    {
      type: "image_url",
      image_url: { url: dataUrlOrUrl },
    },
  ]);
}

export function describeBlock(result) {
  if (!result || result.ok) return null;
  const cat = result.category || "policy";
  if (cat === "sexual" || cat === "sexual/minors") {
    return "Sexual or NSFW content isn't allowed.";
  }
  if (cat === "hate" || cat === "hate/threatening") {
    return "Hate speech or slurs aren't allowed.";
  }
  if (cat === "harassment" || cat === "harassment/threatening") {
    return "Harassment or threats aren't allowed.";
  }
  if (cat === "self-harm" || cat === "self-harm/intent" || cat === "self-harm/instructions") {
    return "Self-harm content isn't allowed.";
  }
  if (cat === "violence" || cat === "violence/graphic") {
    return "Graphic violence isn't allowed.";
  }
  if (cat === "illicit" || cat === "illicit/violent") {
    return "Illegal-activity content isn't allowed.";
  }
  return "This content doesn't meet our community guidelines.";
}
