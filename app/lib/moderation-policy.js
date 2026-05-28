/** When true, skipped moderation/LLM layers must block — not fail open. */
export function moderationRequired() {
  return (
    process.env.REQUIRE_MODERATION_API === "true" ||
    process.env.NODE_ENV === "production"
  );
}

export const MODERATION_UNAVAILABLE_MESSAGE =
  "Safety review is temporarily unavailable. Please try again in a few minutes.";
