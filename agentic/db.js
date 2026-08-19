// SQLite persistence for eval runs. Box-only; git-ignored under data/.
import Database from "better-sqlite3";
import fs from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data");
export const IMAGES_DIR = path.join(DATA_DIR, "evals", "images");
const DB_PATH = path.join(DATA_DIR, "evals.db");

let db;
export function getDb() {
  if (db) return db;
  fs.mkdirSync(IMAGES_DIR, { recursive: true });
  db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      label TEXT NOT NULL,
      config_json TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'running',
      started_at TEXT NOT NULL,
      finished_at TEXT
    );
    CREATE TABLE IF NOT EXISTS generations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id INTEGER NOT NULL REFERENCES runs(id),
      prompt_id TEXT NOT NULL,
      status TEXT NOT NULL,
      approved INTEGER,
      image_path TEXT,
      renders INTEGER,
      cost_usd REAL,
      ledger_json TEXT,
      trace_json TEXT,
      duration_ms INTEGER,
      error TEXT,
      created_at TEXT NOT NULL,
      UNIQUE(run_id, prompt_id)
    );
    CREATE INDEX IF NOT EXISTS idx_gen_run ON generations(run_id);
    CREATE INDEX IF NOT EXISTS idx_gen_prompt ON generations(prompt_id);
  `);
  return db;
}

export function createRun(label, config) {
  const d = getDb();
  const r = d
    .prepare("INSERT INTO runs (label, config_json, started_at) VALUES (?, ?, ?)")
    .run(label, JSON.stringify(config), new Date().toISOString());
  return r.lastInsertRowid;
}

export function finishRun(runId, status = "done") {
  getDb()
    .prepare("UPDATE runs SET status = ?, finished_at = ? WHERE id = ?")
    .run(status, new Date().toISOString(), runId);
}

export function saveGeneration(g) {
  getDb()
    .prepare(
      `INSERT INTO generations
       (run_id, prompt_id, status, approved, image_path, renders, cost_usd,
        ledger_json, trace_json, duration_ms, error, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(run_id, prompt_id) DO UPDATE SET
        status=excluded.status, approved=excluded.approved,
        image_path=excluded.image_path, renders=excluded.renders,
        cost_usd=excluded.cost_usd, ledger_json=excluded.ledger_json,
        trace_json=excluded.trace_json, duration_ms=excluded.duration_ms,
        error=excluded.error`
    )
    .run(
      g.runId,
      g.promptId,
      g.status,
      g.approved == null ? null : g.approved ? 1 : 0,
      g.imagePath || null,
      g.renders ?? null,
      g.costUsd ?? null,
      g.ledger ? JSON.stringify(g.ledger) : null,
      g.trace ? JSON.stringify(g.trace) : null,
      g.durationMs ?? null,
      g.error || null,
      new Date().toISOString()
    );
}

export function listRuns() {
  return getDb()
    .prepare(
      `SELECT r.*, COUNT(g.id) AS generations,
              SUM(g.cost_usd) AS total_cost,
              SUM(CASE WHEN g.approved = 1 THEN 1 ELSE 0 END) AS approved_count,
              SUM(CASE WHEN g.status = 'error' THEN 1 ELSE 0 END) AS error_count
       FROM runs r LEFT JOIN generations g ON g.run_id = r.id
       GROUP BY r.id ORDER BY r.id DESC`
    )
    .all();
}

export function getRun(runId) {
  return getDb().prepare("SELECT * FROM runs WHERE id = ?").get(runId);
}

export function listGenerations(runId) {
  return getDb()
    .prepare("SELECT * FROM generations WHERE run_id = ? ORDER BY prompt_id")
    .all(runId);
}

export function gridData(runIds) {
  const d = getDb();
  const placeholders = runIds.map(() => "?").join(",");
  return d
    .prepare(
      `SELECT run_id, prompt_id, status, approved, image_path, renders,
              cost_usd, duration_ms
       FROM generations WHERE run_id IN (${placeholders})`
    )
    .all(...runIds);
}
