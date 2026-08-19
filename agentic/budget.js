// Cost control. Three layers, all enforced in code, not convention:
//   1. per-generation cap  — pipeline maxUsd (default $2)
//   2. per-run cap         — eval runner aborts the run at the cap
//   3. monthly caps, DISTINCT per category:
//        eval    — test spend: eval runs + optimizer analysis
//        runtime — production spend: user-facing generation (phase 2)
//      Every spender checks its category's remaining budget before starting
//      and records what it spent.
// Caps live in the DB (budget_config) so the admin UI shows them and a CLI
// can change them without code edits:
//   node agentic/budget-cli.mjs                 # show caps + MTD spend
//   node agentic/budget-cli.mjs --set monthly_cap_eval_usd 100
import { getDb } from "./db.js";

const DEFAULTS = {
  monthly_cap_eval_usd: 250,
  monthly_cap_runtime_usd: 100,
  per_run_cap_usd: 25,
  per_generation_cap_usd: 2,
};

export const CATEGORIES = ["eval", "runtime"];

function ensureTables() {
  getDb().exec(`
    CREATE TABLE IF NOT EXISTS budget_config (
      key TEXT PRIMARY KEY,
      value REAL NOT NULL
    );
    CREATE TABLE IF NOT EXISTS spend_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'eval',
      usd REAL NOT NULL,
      note TEXT,
      created_at TEXT NOT NULL
    );
  `);
}

export function getCaps() {
  ensureTables();
  const rows = getDb().prepare("SELECT key, value FROM budget_config").all();
  const caps = { ...DEFAULTS };
  for (const r of rows) caps[r.key] = r.value;
  return caps;
}

export function setCap(key, value) {
  if (!(key in DEFAULTS)) throw new Error(`unknown cap: ${key} (valid: ${Object.keys(DEFAULTS).join(", ")})`);
  ensureTables();
  getDb()
    .prepare(
      "INSERT INTO budget_config (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
    )
    .run(key, value);
}

function monthStartIso() {
  const d = new Date();
  d.setUTCDate(1);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

/**
 * Month-to-date spend for a category.
 * eval: all eval-run generations + 'eval' spend_events (optimizer analysis).
 * runtime: 'runtime' spend_events (user-facing generations record here).
 */
export function monthToDateSpend(category = "eval") {
  ensureTables();
  const since = monthStartIso();
  const d = getDb();
  const events =
    d
      .prepare(
        "SELECT SUM(usd) AS s FROM spend_events WHERE created_at >= ? AND category = ?"
      )
      .get(since, category).s || 0;
  if (category !== "eval") return events;
  const gen =
    d
      .prepare("SELECT SUM(cost_usd) AS s FROM generations WHERE created_at >= ?")
      .get(since).s || 0;
  return gen + events;
}

export function recordSpend(source, usd, { category = "eval", note } = {}) {
  ensureTables();
  getDb()
    .prepare(
      "INSERT INTO spend_events (source, category, usd, note, created_at) VALUES (?, ?, ?, ?, ?)"
    )
    .run(source, category, usd, note || null, new Date().toISOString());
}

/** Throws unless at least estUsd remains in the category's monthly budget. */
export function assertBudget(estUsd, who, category = "eval") {
  const caps = getCaps();
  const capKey = `monthly_cap_${category}_usd`;
  const spent = monthToDateSpend(category);
  const remaining = caps[capKey] - spent;
  if (remaining < estUsd) {
    throw new Error(
      `BUDGET REFUSED (${who}, ${category}): needs ~$${estUsd.toFixed(2)}, monthly remaining $${remaining.toFixed(2)} (cap $${caps[capKey]}, MTD $${spent.toFixed(2)}). Raise with: node agentic/budget-cli.mjs --set ${capKey} <n>`
    );
  }
  return { caps, spent, remaining };
}
