/** Strip whitespace and accidental quotes from Vercel env values. */
export function normalizeOpenAIKey(raw = process.env.OPENAI_API_KEY) {
  if (!raw || typeof raw !== "string") return "";
  return raw.trim().replace(/^["']|["']$/g, "");
}

/** OpenAI key present — required for full safety review on save. */
export function hasOpenAIKey() {
  return Boolean(normalizeOpenAIKey());
}

/**
 * On save/render: block when moderation was skipped but we expect the API to work.
 * Production + API key configured => never ship without a successful moderation call.
 */
export function failClosedOnModerationSkip() {
  if (process.env.REQUIRE_MODERATION_API === "true") return true;
  return process.env.NODE_ENV === "production" && hasOpenAIKey();
}

/** Production deploys must have OPENAI_API_KEY so every save gets reviewed. */
export function saveBlockedWithoutApi() {
  return process.env.NODE_ENV === "production" && !hasOpenAIKey();
}

export const MODERATION_UNAVAILABLE_MESSAGE =
  "Our safety check hiccuped for a second — nothing wrong with your captions. Tap Save & Render again and it should go through.";

export const MODERATION_NOT_CONFIGURED_MESSAGE =
  "Safety review isn't set up on this site yet. The team needs to add an OpenAI API key in Vercel.";
