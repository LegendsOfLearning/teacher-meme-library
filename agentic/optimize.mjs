#!/usr/bin/env node
// Optimizer agent: reads a finished eval run, diagnoses failure patterns by
// LOOKING at the images and traces, proposes an improved prompt-set (stored
// as a new version in prompt_sets), and launches the follow-up eval run.
//
// This agent does the analysis and improvement — humans and dev sessions
// only invoke it:
//
//   node agentic/optimize.mjs --from-run 2
//   node agentic/optimize.mjs --from-run 2 --no-launch        # propose only
//   node agentic/optimize.mjs --from-run 2 --launch-limit 10  # cheaper follow-up
import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import { fileURLToPath } from "url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
process.chdir(root);
const envFile = path.join(root, ".env.local");
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, "utf8").split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
  }
}

const { default: Anthropic } = await import("@anthropic-ai/sdk");
const sharp = (await import("sharp")).default;
const db = await import("./db.js");
const promptStore = await import("./prompt-store.js");
const { anthropicCallCost } = await import("./pricing.js");
const budget = await import("./budget.js");

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
}
const fromRunId = Number(arg("from-run"));
if (!fromRunId) {
  console.error("Required: --from-run <run id>");
  process.exit(1);
}
const noLaunch = process.argv.includes("--no-launch");
const launchLimit = Number(arg("launch-limit", "0")) || 0;
const MODEL = arg("model", "claude-opus-5");

const run = db.getRun(fromRunId);
if (!run) {
  console.error(`run ${fromRunId} not found`);
  process.exit(1);
}
const runConfig = JSON.parse(run.config_json);
const basePromptSetId = runConfig.promptSetId || promptStore.seedPromptSet();
const basePromptSet = promptStore.getPromptSet(basePromptSetId);
const gens = db.listGenerations(fromRunId);

const SYSTEM = `You are the prompt optimizer for an agentic meme-image pipeline. An eval run has completed: each generation was produced by an orchestrator agent (system prompt A) whose finalized image was judged by an adversarial critic (system prompt B).

Your job:
1. Use get_generation to inspect a representative sample — prioritize unapproved/expensive/many-render generations, but look at a few approved ones too. LOOK at the images; read the traces for repeated defects (black bars, illegible text, generic composition, wasted renders, critic disagreements).
2. Diagnose the systematic weaknesses of the CURRENT prompts (provided below).
3. Call propose_prompt_set exactly once with a complete improved orchestrator system prompt and critic system prompt (full replacement text, not diffs) plus a rationale naming the specific observed failures each change targets. Keep everything that already works; change what the evidence says is failing. Do not weaken safety or the full-bleed requirement.

CURRENT ORCHESTRATOR SYSTEM PROMPT:
<<<
${basePromptSet.orchestrator_system}
>>>
CURRENT CRITIC SYSTEM PROMPT:
<<<
${basePromptSet.critic_system}
>>>`;

const TOOLS = [
  {
    name: "get_generation",
    description:
      "Fetch one generation from the eval run: its final image (you will see it), trace, cost, and verdict.",
    input_schema: {
      type: "object",
      properties: { prompt_id: { type: "string" } },
      required: ["prompt_id"],
      additionalProperties: false,
    },
  },
  {
    name: "propose_prompt_set",
    description:
      "Store the improved prompt set as a new version. Call exactly once, when your diagnosis is complete.",
    input_schema: {
      type: "object",
      properties: {
        label: { type: "string" },
        orchestrator_system: { type: "string" },
        critic_system: { type: "string" },
        rationale: { type: "string" },
      },
      required: ["label", "orchestrator_system", "critic_system", "rationale"],
      additionalProperties: false,
    },
  },
];

const summaryLines = gens.map(
  (g) =>
    `${g.prompt_id}: ${g.status}${g.approved ? " APPROVED" : " unapproved"}, ${g.renders ?? 0} renders, $${(g.cost_usd || 0).toFixed(3)}${g.error ? `, error: ${g.error.slice(0, 80)}` : ""}`
);

budget.assertBudget(5, "optimizer analysis", "eval");

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const messages = [
  {
    role: "user",
    content: `Run ${fromRunId} ("${run.label}") summary — ${gens.length} generations:\n${summaryLines.join("\n")}\n\nInspect a sample with get_generation, then propose the improved prompt set.`,
  },
];

let newPromptSetId = null;
let usd = 0;
let inspected = 0;

while (!newPromptSetId) {
  // Streaming with a large ceiling: the proposal tool call carries two full
  // system prompts, which can exceed a non-streaming-safe max_tokens.
  const response = await anthropic.messages
    .stream({
      model: MODEL,
      max_tokens: 32000,
      system: SYSTEM,
      tools: TOOLS,
      messages,
    })
    .finalMessage();
  usd += anthropicCallCost(MODEL, response.usage);
  messages.push({ role: "assistant", content: response.content });
  if (response.stop_reason !== "tool_use") {
    console.error(`optimizer stopped (${response.stop_reason}) without proposing; spent $${usd.toFixed(2)}`);
    process.exit(1);
  }
  const results = [];
  for (const block of response.content) {
    if (block.type !== "tool_use") continue;
    if (block.name === "get_generation") {
      const g = gens.find((x) => x.prompt_id === block.input.prompt_id);
      inspected += 1;
      if (!g) {
        results.push({ type: "tool_result", tool_use_id: block.id, is_error: true, content: "unknown prompt_id" });
        continue;
      }
      const content = [];
      if (g.image_path) {
        const png = fs.readFileSync(path.join(db.IMAGES_DIR, g.image_path));
        const small = await sharp(png).resize(512, 512, { fit: "inside" }).png().toBuffer();
        content.push({
          type: "image",
          source: { type: "base64", media_type: "image/png", data: small.toString("base64") },
        });
      }
      content.push({
        type: "text",
        text: `trace: ${(g.trace_json || "[]").slice(0, 4000)}`,
      });
      results.push({ type: "tool_result", tool_use_id: block.id, content });
    } else if (block.name === "propose_prompt_set") {
      newPromptSetId = promptStore.createPromptSet({
        label: block.input.label,
        orchestratorSystem: block.input.orchestrator_system,
        criticSystem: block.input.critic_system,
        parentId: basePromptSetId,
        rationale: block.input.rationale,
        source: `optimizer:run-${fromRunId}`,
      });
      results.push({
        type: "tool_result",
        tool_use_id: block.id,
        content: `Stored as prompt set ${newPromptSetId}.`,
      });
      console.log(`\nprompt set ${newPromptSetId} "${block.input.label}" (parent ${basePromptSetId})`);
      console.log(`rationale: ${block.input.rationale}\n`);
    }
  }
  messages.push({ role: "user", content: results });
  if (inspected > 25) {
    messages.push({
      role: "user",
      content: "Inspection budget reached — propose the improved prompt set now.",
    });
  }
}

budget.recordSpend(`optimizer:run-${fromRunId}`, usd, {
  category: "eval",
  note: `analysis producing prompt set ${newPromptSetId}`,
});
console.log(`optimizer done: inspected ${inspected} generations, spent $${usd.toFixed(2)} on analysis`);

if (noLaunch) {
  console.log(`follow-up (not launched): node evals/run.mjs --label "opt v${newPromptSetId}" --prompt-set ${newPromptSetId}`);
  process.exit(0);
}

// Launch the follow-up eval run with the improved prompts, same knobs.
const evalArgs = [
  "evals/run.mjs",
  "--label",
  `optimized v${newPromptSetId} (from run ${fromRunId})`,
  "--prompt-set",
  String(newPromptSetId),
  "--concurrency",
  "4",
];
if (runConfig.ipSafeOnly) evalArgs.push("--ip-safe");
if (launchLimit) evalArgs.push("--limit", String(launchLimit));
console.log(`launching follow-up eval: node ${evalArgs.join(" ")}`);
const child = spawn("node", evalArgs, { stdio: "inherit" });
child.on("exit", (code) => process.exit(code ?? 0));
