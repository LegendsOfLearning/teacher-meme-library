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

const { runAgenticGeneration } = await import("../agentic/pipeline.js");
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

const promptSetId = Number(arg("prompt-set", String(promptStore.seedPromptSet())));
const promptSet = promptStore.getPromptSet(promptSetId);
if (!promptSet) {
  console.error(`prompt set ${promptSetId} not found`);
  process.exit(1);
}
const ipSafeOnly = process.argv.includes("--ip-safe");

const config = {
  orchestratorModel,
  criticModel: orchestratorModel,
  maxRenders: Number(arg("max-renders", "6")),
  maxCriticRounds: 2,
  maxUsd: Number(arg("max-usd", "2.0")),
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
const estPerMeme = 0.2;
budget.assertBudget(Math.min(prompts.length * estPerMeme, perRunCap), "evals/run.mjs", "eval");
let capped = false;

const { prompts: _promptBodies, ...configForRecord } = config;
const runId = db.createRun(label, { ...configForRecord, promptCount: prompts.length });
const runDir = path.join(db.IMAGES_DIR, String(runId));
fs.mkdirSync(runDir, { recursive: true });
console.log(
  `run ${runId} "${label}" — ${prompts.length} prompts, model=${orchestratorModel}, concurrency=${concurrency}`
);

let done = 0;
let totalCost = 0;

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
    const result = await runAgenticGeneration(
      {
        situation: p.situation,
        tone: p.tone,
        captionIdea: p.captionIdea,
      },
      config
    );
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
    done += 1;
    console.log(
      `  [${done}/${prompts.length}] ${p.id} ${result.approved ? "APPROVED" : "unapproved"} $${result.costUsd.toFixed(3)} (${result.candidates.length} renders)`
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
