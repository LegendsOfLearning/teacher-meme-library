// Editable price table. USD. Update when vendors reprice.
export const PRICES = {
  anthropic: {
    // per 1M tokens: [input, output]
    "claude-opus-5": { input: 5.0, output: 25.0 },
    "claude-sonnet-5": { input: 3.0, output: 15.0 },
    "claude-haiku-4-5": { input: 1.0, output: 5.0 },
  },
  openaiImage: {
    // gpt-image-2, per 1024x1024 image by quality; text input per 1M tokens
    "gpt-image-2": {
      perImage: { low: 0.011, medium: 0.042, high: 0.167 },
      textInputPer1M: 5.0,
    },
  },
};

// Prompt-cache multipliers (Anthropic): a 5-minute cache write costs 1.25x
// the base input rate, a cache read 0.1x. `input_tokens` excludes both, so
// ignoring them would under-report the true cost of every cached call.
const CACHE_WRITE_MULTIPLIER = 1.25;
const CACHE_READ_MULTIPLIER = 0.1;

export function anthropicCallCost(model, usage) {
  const p = PRICES.anthropic[model];
  if (!p || !usage) return 0;
  return (
    ((usage.input_tokens || 0) * p.input +
      (usage.cache_creation_input_tokens || 0) * p.input * CACHE_WRITE_MULTIPLIER +
      (usage.cache_read_input_tokens || 0) * p.input * CACHE_READ_MULTIPLIER +
      (usage.output_tokens || 0) * p.output) /
    1_000_000
  );
}

export function imageCallCost(model, quality, promptTokens = 0) {
  const p = PRICES.openaiImage[model];
  if (!p) return 0;
  return (
    (p.perImage[quality] ?? p.perImage.medium) +
    (promptTokens * p.textInputPer1M) / 1_000_000
  );
}
