// Versioned prompt-sets. The orchestrator/critic system prompts are data,
// not code: the optimizer agent proposes new versions here, eval runs pin
// the version they used, and the grid compares them over time.
import fs from "fs";
import path from "path";
import { getDb } from "./db.js";

export const SEED_ORCHESTRATOR_SYSTEM = `You are the meme director for a school-safe teacher meme generator (K-8 brand, Legends of Learning). You work ONLY with the real, existing meme templates in the catalog — you never invent imagery; you pick a format and write captions for its zones.

You will receive a meme brief. Use render_meme to produce candidates and LOOK at each rendered result critically before deciding. Hard requirements:
- The rendered meme must have no avoidable letterboxing or awkward empty bars, and captions must sit correctly in their zones — no text overflowing, cut off, cramped, or shrunk to illegibility. If a caption doesn't fit, shorten it or restructure it; if the format fights the joke, switch formats.
- Captions must be correctly spelled, punchy, and match the format's canonical joke structure (a Drake meme must read like a Drake meme).
- The joke must land for teachers and stay school-safe (no profanity, innuendo, politics, or punching down at students).
- Prefer variety: don't default to the same 2-3 formats when others fit the brief's structure better.

Iterate: render, inspect, improve captions or switch formats, render again. When one candidate clearly meets every requirement, call finalize with its candidate id. You have a limited render budget — make each revision count by naming the specific defect you are fixing.`;

export const SEED_CRITIC_SYSTEM = `You are an adversarial reviewer for a K-8 education brand. Your default is REJECT. You are judging a caption-on-real-template meme. Approve only if (a) captions sit cleanly in their zones — nothing overflowing, clipped, cramped, or too small to read, and no avoidable letterboxing/black bars, (b) spelling and grammar are correct, (c) it is school-safe, and (d) the captions genuinely follow this format's canonical joke structure and the joke lands for teachers. Respond with JSON only: {"approve": boolean, "issues": ["..."]}.`;

function ensureTable() {
  const d = getDb();
  d.exec(`
    CREATE TABLE IF NOT EXISTS prompt_sets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      label TEXT NOT NULL,
      orchestrator_system TEXT NOT NULL,
      critic_system TEXT NOT NULL,
      parent_id INTEGER,
      rationale TEXT,
      source TEXT NOT NULL DEFAULT 'human',
      created_at TEXT NOT NULL
    );
  `);
  const cols = d.prepare("PRAGMA table_info(prompt_sets)").all();
  if (!cols.some((c) => c.name === "is_active")) {
    d.exec("ALTER TABLE prompt_sets ADD COLUMN is_active INTEGER NOT NULL DEFAULT 0");
  }
}

/** The ACTIVE set — the one production and default eval runs use. */
export function getActivePromptSet() {
  ensureTable();
  const row = getDb()
    .prepare("SELECT * FROM prompt_sets WHERE is_active = 1 LIMIT 1")
    .get();
  return row || getPromptSet(seedPromptSet());
}

/** Promote a set to ACTIVE and write the committed frontend snapshot. */
export function promoteActive(id) {
  ensureTable();
  const set = getPromptSet(id);
  if (!set) throw new Error(`prompt set ${id} not found`);
  const d = getDb();
  d.prepare("UPDATE prompt_sets SET is_active = 0 WHERE is_active = 1").run();
  d.prepare("UPDATE prompt_sets SET is_active = 1 WHERE id = ?").run(id);
  const snapshot = {
    _comment:
      "ACTIVE prompt-set snapshot, written by `node agentic/prompt-cli.mjs --promote <id>`. Used by the Vercel frontend; the box DB (prompt_sets) is the source of truth. Do not hand-edit.",
    promptSetId: set.id,
    label: set.label,
    source: set.source,
    parentId: set.parent_id,
    promotedAt: new Date().toISOString(),
    orchestrator_system: set.orchestrator_system,
    critic_system: set.critic_system,
  };
  fs.writeFileSync(
    path.join(process.cwd(), "agentic", "active-prompts.json"),
    JSON.stringify(snapshot, null, 2)
  );
  return snapshot;
}

export function seedPromptSet() {
  ensureTable();
  const d = getDb();
  // Template-workflow seed (existing-memes pipeline). Earlier image-gen
  // prompt sets remain as history but are not the seed anymore.
  const existing = d
    .prepare("SELECT id FROM prompt_sets WHERE source = 'seed-template' ORDER BY id LIMIT 1")
    .get();
  if (existing) return existing.id;
  const r = d
    .prepare(
      `INSERT INTO prompt_sets (label, orchestrator_system, critic_system, source, rationale, created_at)
       VALUES ('template seed v1', ?, ?, 'seed-template', 'Seed for the existing-memes (caption-on-template) pipeline.', ?)`
    )
    .run(SEED_ORCHESTRATOR_SYSTEM, SEED_CRITIC_SYSTEM, new Date().toISOString());
  return r.lastInsertRowid;
}

export function getPromptSet(id) {
  ensureTable();
  return getDb().prepare("SELECT * FROM prompt_sets WHERE id = ?").get(id);
}

export function listPromptSets() {
  ensureTable();
  return getDb()
    .prepare(
      "SELECT id, label, parent_id, source, rationale, created_at, is_active, length(orchestrator_system) AS orch_len, length(critic_system) AS critic_len FROM prompt_sets ORDER BY id DESC"
    )
    .all();
}

export function createPromptSet({ label, orchestratorSystem, criticSystem, parentId, rationale, source }) {
  ensureTable();
  const r = getDb()
    .prepare(
      `INSERT INTO prompt_sets (label, orchestrator_system, critic_system, parent_id, rationale, source, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      label,
      orchestratorSystem,
      criticSystem,
      parentId ?? null,
      rationale ?? null,
      source || "agent",
      new Date().toISOString()
    );
  return r.lastInsertRowid;
}
