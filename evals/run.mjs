#!/usr/bin/env node
// Eval runner: executes the 50 canonical prompts through the agentic
// pipeline and records everything (images, traces, costs) in SQLite.
//
//   node evals/run.mjs --label "template seed baseline"
//   node evals/run.mjs --label "harness test" --limit 2
//   node evals/run.mjs --label "full sweep" --all       # all 50 prompts
//   Default: 10 representative prompts (one per situation, tones rotating).
//
// Reads .env.local for ANTHROPIC_API_KEY / IMAGE_API_KEY.
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
process.chdir(root);

// Minimal .env.local loader (no dep).
const envFile = path.join(root, ".env.local");
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, "utf8").split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
  }
}

const { runAgenticGeneration, runRoutedGeneration, runCheapGeneration } =
  await import("../agentic/pipeline.js");
const { canonicalPrompts, sampledPrompts } = await import("./prompts.mjs");
const db = await import("../agentic/db.js");
const promptStore = await import("../agentic/prompt-store.js");
const budget = await import("../agentic/budget.js");

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
}

const label = arg("label");
if (!label) {
  console.error('Required: --label "what changed in this run"');
  process.exit(1);
}
const runAll = process.argv.includes("--all");
const limit = Number(arg("limit", "0")) || 0;
const concurrency = Number(arg("concurrency", "3")) || 3;
const orchestratorModel = arg("model", "claude-opus-5");
// --models "claude-haiku-4-5,claude-sonnet-5,claude-opus-5" = escalation
// router: cheapest first, escalate only when the critic won't approve.
const modelLadder = arg("models", "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

// Default: the ACTIVE prompt set (clearly marked in prompt-cli / admin).
const promptSetId = Number(
  arg("prompt-set", String(promptStore.getActivePromptSet().id))
);
const promptSet = promptStore.getPromptSet(promptSetId);
if (!promptSet) {
  console.error(`prompt set ${promptSetId} not found`);
  process.exit(1);
}
const ipSafeOnly = process.argv.includes("--ip-safe");
// --engine cheap: deterministic lint replaces the vision loop; the writer is
// text-only and one critic call is the whole vision spend.
const engine = arg("engine", "agentic");
if (!["agentic", "cheap"].includes(engine)) {
  console.error(`--engine must be "agentic" or "cheap" (got "${engine}")`);
  process.exit(1);
}

const config = {
  engine,
  orchestratorModel,
  // The cheap engine's writer is the model flag; its critic is the vision gate.
  writerModel: engine === "cheap" ? arg("model", "claude-haiku-4-5") : orchestratorModel,
  // --critic-model lets a cheap generator be gated by a strong critic —
  // the judge data shows same-model critics are lenient for weak models.
  criticModel: arg("critic-model", orchestratorModel),
  modelLadder: modelLadder.length ? modelLadder : undefined,
  maxRenders: Number(arg("max-renders", "6")),
  maxCriticRounds: 2,
  maxWriterRounds: Number(arg("max-writer-rounds", "3")),
  maxVisionChecks: Number(arg("max-vision-checks", "2")),
  maxUsd: Number(arg("max-usd", engine === "cheap" ? "0.5" : "2.0")),
  ipSafeOnly,
  promptSetId,
  prompts: {
    orchestrator_system: promptSet.orchestrator_system,
    critic_system: promptSet.critic_system,
  },
};

// Default run: 10 representative prompts (one per situation, tones rotating);
// --all for the full 50; --limit N for harness tests.
let prompts = runAll ? canonicalPrompts() : sampledPrompts(10);
if (limit) prompts = prompts.slice(0, limit);

// Cost control: pre-flight against the monthly eval budget and hard-abort
// at the per-run cap. Rendering is local templates ($0); spend is Claude tokens.
const caps = budget.getCaps();
const perRunCap = Number(arg("max-run-usd", String(caps.per_run_cap_usd)));
const estPerMeme = engine === "cheap" ? 0.05 : 0.2;
budget.assertBudget(Math.min(prompts.length * estPerMeme, perRunCap), "evals/run.mjs", "eval");
let capped = false;

const { prompts: _promptBodies, ...configForRecord } = config;
const runId = db.createRun(label, { ...configForRecord, promptCount: prompts.length });
const runDir = path.join(db.IMAGES_DIR, String(runId));
fs.mkdirSync(runDir, { recursive: true });
console.log(
  `run ${runId} "${label}" — ${prompts.length} prompts, engine=${engine}, model=${
    engine === "cheap" ? `${config.writerModel} (writer) + ${config.criticModel} (critic)` : orchestratorModel
  }, concurrency=${concurrency}`
);

let done = 0;
let totalCost = 0;
// Batch-level variety: formats already used twice in this run go on the
// avoid list for subsequent briefs (concurrency makes this best-effort).
const formatUsage = new Map();
// Token/cache accounting, split by role, so cost per meme is explainable and
// prompt-cache effectiveness is measured rather than assumed.
const newBucket = () => ({ calls: 0, input: 0, output: 0, cacheWrite: 0, cacheRead: 0, usd: 0 });
const tokenTotals = { writer: newBucket(), critic: newBucket(), other: newBucket() };

async function runOne(p) {
  const t0 = Date.now();
  if (capped || totalCost >= perRunCap) {
    if (!capped) {
      capped = true;
      console.error(`per-run cap $${perRunCap} reached at $${totalCost.toFixed(2)} — skipping remaining prompts`);
    }
    db.saveGeneration({ runId, promptId: p.id, status: "skipped_budget", durationMs: 0 });
    done += 1;
    return;
  }
  try {
    const brief = {
      situation: p.situation,
      tone: p.tone,
      captionIdea: p.captionIdea,
    };
    const avoidFormats = [...formatUsage.entries()]
      .filter(([, n]) => n >= 2)
      .map(([f]) => f);
    const cfgOne = { ...config, avoidFormats };
    const result =
      engine === "cheap"
        ? await runCheapGeneration(brief, cfgOne)
        : modelLadder.length
          ? await runRoutedGeneration(brief, cfgOne, modelLadder)
          : await runAgenticGeneration(brief, cfgOne);
    if (result.formatId) {
      formatUsage.set(result.formatId, (formatUsage.get(result.formatId) || 0) + 1);
    }
    const promptDir = path.join(runDir, p.id);
    fs.mkdirSync(promptDir, { recursive: true });
    let imagePath = null;
    if (result.finalPng) {
      imagePath = path.join(String(runId), p.id, "final.png");
      fs.writeFileSync(path.join(db.IMAGES_DIR, imagePath), result.finalPng);
    }
    for (const c of result.candidates) {
      fs.writeFileSync(path.join(promptDir, `candidate-${c.id}.png`), c.png);
    }
    db.saveGeneration({
      runId,
      promptId: p.id,
      status: result.finalPng ? "done" : "no_image",
      approved: result.approved,
      imagePath,
      renders: result.candidates.length,
      costUsd: result.costUsd,
      ledger: result.ledger,
      trace: result.trace,
      durationMs: Date.now() - t0,
    });
    totalCost += result.costUsd;
    for (const e of result.ledger || []) {
      const u = e.usage || {};
      const bucket = e.step.startsWith("writer")
        ? tokenTotals.writer
        : e.step.startsWith("critic")
          ? tokenTotals.critic
          : tokenTotals.other;
      bucket.calls += 1;
      bucket.input += u.input_tokens || 0;
      bucket.output += u.output_tokens || 0;
      bucket.cacheWrite += u.cache_creation_input_tokens || 0;
      bucket.cacheRead += u.cache_read_input_tokens || 0;
      bucket.usd += e.usd || 0;
    }
    const lintFails = (result.trace || []).filter(
      (t) => t.step === "lint" && t.ok === false
    ).length;
    const writerCalls = (result.ledger || []).filter((e) => e.step.startsWith("writer")).length;
    const criticCalls = (result.ledger || []).filter((e) => e.step.startsWith("critic")).length;
    done += 1;
    console.log(
      `  [${done}/${prompts.length}] ${p.id} ${result.approved ? "APPROVED" : "unapproved"} $${result.costUsd.toFixed(3)} (${result.candidates.length} renders${
        engine === "cheap"
          ? `, writer x${writerCalls}, critic x${criticCalls}, lint rejections ${lintFails}`
          : ""
      })`
    );
  } catch (e) {
    db.saveGeneration({
      runId,
      promptId: p.id,
      status: "error",
      error: e.message,
      durationMs: Date.now() - t0,
    });
    done += 1;
    console.error(`  [${done}/${prompts.length}] ${p.id} ERROR: ${e.message}`);
  }
}

const queue = [...prompts];
await Promise.all(
  Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
    while (queue.length) await runOne(queue.shift());
  })
);

db.finishRun(runId, capped ? "capped" : "done");
console.log(`run ${runId} ${capped ? "CAPPED" : "complete"} — total $${totalCost.toFixed(2)}`);

// Cost breakdown by role + measured prompt-cache effect.
{
  const nDone = Math.max(done, 1);
  for (const [role, b] of Object.entries(tokenTotals)) {
    if (!b.calls) continue;
    const cacheable = b.input + b.cacheWrite + b.cacheRead;
    console.log(
      `  ${role}: ${b.calls} calls, in ${b.input} / cache-write ${b.cacheWrite} / cache-read ${b.cacheRead} (${
        cacheable ? ((b.cacheRead / cacheable) * 100).toFixed(0) : 0
      }% of input served from cache), out ${b.output}, $${b.usd.toFixed(3)} ($${(b.usd / nDone).toFixed(4)}/meme)`
    );
  }
  console.log(`  average cost/meme: $${(totalCost / nDone).toFixed(4)}`);
}

// Batch diversity report: repetition is a brand defect even when every
// individual meme is clean, so it is measured per run.
const dist = [...formatUsage.entries()].sort((a, b) => b[1] - a[1]);
const nFinal = dist.reduce((s, [, n]) => s + n, 0);
if (nFinal) {
  console.log(`format diversity: ${dist.length} distinct formats over ${nFinal} memes; top share ${(dist[0][1] / nFinal * 100).toFixed(0)}% (${dist[0][0]})`);
  console.log(`  distribution: ${dist.map(([f, n]) => `${f}=${n}`).join(" ")}`);
}
