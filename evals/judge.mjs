#!/usr/bin/env node
// Independent judge: a FIXED model (default claude-opus-5) scores every
// generation's final meme on one rubric, regardless of which model produced
// it. This is what makes cross-model runs comparable — per-run "approved"
// comes from that run's own critic (same model as the generator), which is
// lenient for weak models and strict for strong ones.
//
//   node evals/judge.mjs --runs 7,8,9,10,11
//   node evals/judge.mjs --runs 12 --judge-model claude-opus-5
import fs from "fs";
import path from "path";
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
const db = await import("../agentic/db.js");
const budget = await import("../agentic/budget.js");
const { anthropicCallCost } = await import("../agentic/pricing.js");

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
}
const runIds = (arg("runs", "") || "")
  .split(",")
  .map(Number)
  .filter(Boolean);
if (!runIds.length) {
  console.error("Required: --runs 7,8,9");
  process.exit(1);
}
const JUDGE_MODEL = arg("judge-model", "claude-opus-5");

// Schema migration: judge columns.
{
  const d = db.getDb();
  const cols = d.prepare("PRAGMA table_info(generations)").all();
  for (const [name, type] of [
    ["judge_score", "REAL"],
    ["judge_json", "TEXT"],
    ["judge_model", "TEXT"],
  ]) {
    if (!cols.some((c) => c.name === name)) {
      d.exec(`ALTER TABLE generations ADD COLUMN ${name} ${type}`);
    }
  }
}

const JUDGE_SYSTEM = `You are a fixed, independent judge for teacher memes rendered on real meme templates (K-8 education brand). Score the meme 1-10:
- 9-10: caption fits zones perfectly, legible, correct spelling, canonical joke structure, genuinely funny for teachers, school-safe.
- 7-8: solid; minor nits (slightly small text, slightly generic joke).
- 5-6: noticeable defects (cramped/overflowing text, weak or mismatched joke structure).
- 1-4: broken (illegible, wrong zones, off-format, unsafe, or not funny at all).
Respond with JSON only: {"score": number, "issues": ["..."]}.`;

budget.assertBudget(runIds.length * 0.5, "evals/judge.mjs", "eval");
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
let spent = 0;

for (const runId of runIds) {
  const gens = db.listGenerations(runId).filter((g) => g.image_path);
  console.log(`run ${runId}: judging ${gens.length} finals with ${JUDGE_MODEL}`);
  for (const g of gens) {
    const png = fs.readFileSync(path.join(db.IMAGES_DIR, g.image_path));
    const small = await sharp(png).resize(512, 512, { fit: "inside" }).png().toBuffer();
    let trace = [];
    try {
      trace = JSON.parse(g.trace_json || "[]");
    } catch {}
    // Router traces accumulate across escalation tiers; the final image comes
    // from the LAST finalize, so the first one belongs to a rejected tier.
    const finalize = trace.filter((t) => t.step === "finalize").pop();
    const res = await anthropic.messages.create({
      model: JUDGE_MODEL,
      max_tokens: 800,
      system: JUDGE_SYSTEM,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: "image/png", data: small.toString("base64") },
            },
            {
              type: "text",
              text: `Prompt: ${g.prompt_id.replace("__", " / ")}${finalize?.rationale ? `. Creator's rationale: ${finalize.rationale.slice(0, 200)}` : ""}`,
            },
          ],
        },
      ],
    });
    spent += anthropicCallCost(JUDGE_MODEL, res.usage);
    let verdict = { score: null, issues: ["unparseable"] };
    try {
      const raw = res.content.find((b) => b.type === "text")?.text || "";
      verdict = JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] || raw);
    } catch {}
    db.getDb()
      .prepare(
        "UPDATE generations SET judge_score = ?, judge_json = ?, judge_model = ? WHERE id = ?"
      )
      .run(verdict.score, JSON.stringify(verdict), JUDGE_MODEL, g.id);
    console.log(`  ${g.prompt_id}: ${verdict.score}`);
  }
}
budget.recordSpend("judge", spent, {
  category: "eval",
  note: `judged runs ${runIds.join(",")} with ${JUDGE_MODEL}`,
});
console.log(`judging done — $${spent.toFixed(2)}`);

// Per-run summary.
for (const runId of runIds) {
  const row = db
    .getDb()
    .prepare(
      "SELECT AVG(judge_score) AS avg, MIN(judge_score) AS min, COUNT(judge_score) AS n, SUM(cost_usd) AS cost FROM generations WHERE run_id = ? AND judge_score IS NOT NULL"
    )
    .get(runId);
  console.log(
    `run ${runId}: judge avg ${row.avg?.toFixed(2)} (min ${row.min}, n=${row.n}), gen cost $${(row.cost || 0).toFixed(2)}`
  );
}
