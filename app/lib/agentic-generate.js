// User-facing agentic generation (flag-gated: AGENTIC_GENERATE=true).
//
// Runs the cost-routed agentic pipeline (cheapest model first, escalate on
// critic rejection) using the committed ACTIVE prompt-set snapshot
// (agentic/active-prompts.json — promoted via prompt-cli on the box).
//
// Budget notes: the box SQLite budget ledger is unreachable from Vercel
// serverless, so runtime cost control here is (a) the per-generation USD cap
// and (b) a best-effort monthly counter in Vercel Blob that refuses new
// generations past RUNTIME_MONTHLY_CAP_USD (default $100).
import fs from "fs";
import path from "path";
import { runRoutedGeneration } from "../../agentic/pipeline.js";
import { getFormat } from "../../agentic/template-render.js";
import { newMemeId, saveMeme } from "./storage.js";

// Cost-optimal per eval runs 8-13: cheap generator, escalate to Opus only on
// rejection — always gated by a fixed Opus critic (same-tier critics are
// lenient; judge data runs 10-12).
const DEFAULT_LADDER = ["claude-haiku-4-5", "claude-opus-5"];
const DEFAULT_CRITIC = "claude-opus-5";

export function agenticEnabled() {
  return process.env.AGENTIC_GENERATE === "true";
}

function activePrompts() {
  const p = path.join(process.cwd(), "agentic", "active-prompts.json");
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

async function monthlyRuntimeSpend() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return null;
  try {
    const { list } = await import("@vercel/blob");
    const key = `runtime-spend/${new Date().toISOString().slice(0, 7)}.json`;
    const blobs = await list({ prefix: key });
    const hit = blobs.blobs?.find((b) => b.pathname === key);
    if (!hit) return { key, usd: 0 };
    const res = await fetch(hit.url);
    const data = await res.json();
    return { key, usd: data.usd || 0 };
  } catch {
    return null;
  }
}

async function recordRuntimeSpend(counter, usd) {
  if (!counter || !process.env.BLOB_READ_WRITE_TOKEN) return;
  try {
    const { put } = await import("@vercel/blob");
    await put(counter.key, JSON.stringify({ usd: counter.usd + usd }), {
      access: "public",
      addRandomSuffix: false,
      contentType: "application/json",
    });
  } catch {}
}

/**
 * Generate a meme agentically and persist it with full version provenance.
 * Throws {code: "RUNTIME_BUDGET_EXHAUSTED"} when the monthly cap is reached.
 */
export async function agenticGenerateMeme({ situation, tone, formatId }) {
  const prompts = activePrompts();
  const capUsd = Number(process.env.RUNTIME_MONTHLY_CAP_USD || 100);
  const counter = await monthlyRuntimeSpend();
  if (counter && counter.usd >= capUsd) {
    const err = new Error("Monthly generation budget reached.");
    err.code = "RUNTIME_BUDGET_EXHAUSTED";
    throw err;
  }

  const ladder = (process.env.AGENTIC_MODEL_LADDER || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const result = await runRoutedGeneration(
    {
      situation: situation.label || situation.id,
      tone: tone.label || tone.id,
      formatHint: formatId && formatId !== "auto" ? formatId : undefined,
    },
    {
      promptSetId: prompts.promptSetId,
      prompts,
      criticModel: process.env.AGENTIC_CRITIC_MODEL || DEFAULT_CRITIC,
      maxRenders: 4,
      maxCriticRounds: 2,
      maxUsd: Number(process.env.RUNTIME_MAX_USD_PER_MEME || 1.0),
    },
    ladder.length ? ladder : DEFAULT_LADDER
  );
  await recordRuntimeSpend(counter, result.costUsd);
  if (!result.finalPng) {
    const err = new Error("Agentic generation produced no image.");
    err.code = "AGENTIC_NO_IMAGE";
    throw err;
  }

  const format = getFormat(result.formatId);
  const id = newMemeId();
  return saveMeme({
    id,
    pngBuffer: result.finalPng,
    format,
    captions: result.captions,
    meta: {
      situationId: situation.id,
      situationLabel: situation.label,
      toneId: tone.id,
      toneLabel: tone.label,
      approved: result.approved,
      costUsd: result.costUsd,
      // Version provenance: every meme records exactly what produced it.
      provenance: {
        ...result.provenance,
        promptSetLabel: prompts.label,
        promptSetPromotedAt: prompts.promotedAt,
      },
      trace: result.trace,
    },
  });
}
