// Minimal model-agnostic LLM adapter.
//
// Today we hit OpenAI's chat completions endpoint. The agentic
// workflow only ever calls callJSON() / callText() from this file —
// swapping the underlying model (Anthropic, Cursor Agent SDK,
// Claude Code SDK, etc.) means changing one function, not the
// pipeline.

// Default to the full gpt-4.1: the cost diff vs -mini is small for
// short caption / scoring calls, and the humor quality bump is the
// single biggest lever for "actually-funny" output. Override with
// OPENAI_MODEL if you want to A/B a different model.
import { normalizeOpenAIKey } from "./moderation-policy.js";

const DEFAULT_MODEL = "gpt-4.1";
const OPENAI_URL =
  process.env.OPENAI_BASE_URL || "https://api.openai.com/v1/chat/completions";

export function llmConfigured() {
  return Boolean(normalizeOpenAIKey());
}

async function callOpenAI({ system, user, jsonMode, temperature, maxTokens }) {
  const apiKey = normalizeOpenAIKey();
  if (!apiKey) {
    const err = new Error("LLM is not configured (no API key).");
    err.code = "LLM_NOT_CONFIGURED";
    throw err;
  }

  const model = process.env.OPENAI_MODEL || DEFAULT_MODEL;
  const body = {
    model,
    // claude-* models on the Anthropic compat endpoint reject temperature.
    ...(OPENAI_URL.includes("api.openai.com")
      ? { temperature: temperature ?? 0.9 }
      : {}),
    // claude-* reasoning tokens count against max_tokens on the compat
    // endpoint, so give non-OpenAI backends generous headroom.
    max_tokens: OPENAI_URL.includes("api.openai.com")
      ? maxTokens ?? 600
      : Math.max(maxTokens ?? 0, 4000),
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  };
  // Anthropic's OpenAI-compat endpoint only accepts json_schema, not
  // json_object; callJSON already parses/validates, so omit it there.
  if (jsonMode && OPENAI_URL.includes("api.openai.com")) {
    body.response_format = { type: "json_object" };
  }

  const res = await fetch(OPENAI_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const err = new Error(`LLM error ${res.status}: ${text.slice(0, 200)}`);
    err.code = "LLM_HTTP_ERROR";
    err.status = res.status;
    throw err;
  }
  const data = await res.json();
  return data?.choices?.[0]?.message?.content?.trim() || "";
}

/** Call the LLM and require a parsed JSON response. */
export async function callJSON({ system, user, temperature, maxTokens }) {
  const raw = await callOpenAI({
    system,
    user,
    jsonMode: true,
    temperature,
    maxTokens,
  });
  try {
    // Tolerate markdown fences / prose around the JSON object.
    const cleaned = raw.replace(/^```(?:json)?\s*|\s*```$/g, "");
    const match = cleaned.match(/[{[][\s\S]*[}\]]/);
    return JSON.parse(match ? match[0] : cleaned);
  } catch (e) {
    const err = new Error(`Could not parse LLM JSON: ${raw.slice(0, 200)}`);
    err.code = "LLM_BAD_JSON";
    throw err;
  }
}

export async function callText({ system, user, temperature, maxTokens }) {
  return callOpenAI({ system, user, jsonMode: false, temperature, maxTokens });
}
