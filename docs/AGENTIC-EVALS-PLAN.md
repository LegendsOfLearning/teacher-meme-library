# Agentic Image Pipeline + Evals System — Plan

Owner: Shaun. Built 2026-08-19. Status: framework build (phase 1).

## Problem

The current generator is a single-shot template renderer (sharp) with LLM
captions. Image quality issues (black bars, non-full-bleed, weak variety) are
invisible until a human looks, and there is no way to compare quality or cost
across model/config changes over time.

## Architecture decisions

- **Public app stays on Vercel unchanged.** Everything below runs on the dev
  box only, behind the tailnet. Admin routes are gated by `ADMIN_UI=true`,
  which is never set on Vercel — they 404 in production. No tailnet checks
  inside Vercel serverless.
- **DB:** SQLite (`better-sqlite3`) at `data/evals.db`. Images on disk under
  `data/evals/images/<run>/<prompt>/`. Git-ignored; the box is the eval home.
- **Agentic loop:** a manual Anthropic Messages API loop (`agentic/pipeline.js`)
  — Claude (`claude-opus-5`) orchestrates via two tools:
  - `render_image(image_prompt)` → image provider renders; the resulting PNG is
    returned to Claude *as a vision block* so it can see black bars, cropping,
    text legibility, and iterate.
  - `finalize(candidate_id, rationale)` → picks the winner.
  Then an **adversarial pass**: a fresh critic call (no shared context) must
  approve full-bleed/legibility/brand-safety, else the loop resumes with the
  critic's objections. Hard budget caps (max renders, max USD) per generation.
- **Image provider seam** (`agentic/providers/`): `openai` (gpt-image-2) and
  `stub` (sharp placeholder, free) — the stub lets the whole factory run
  end-to-end before the OpenAI key lands and keeps eval-harness tests free.
- **Cost ledger:** every API call (Anthropic tokens, OpenAI images) is recorded
  per step with USD computed from `agentic/pricing.js`. Total + breakdown
  stored per generation.

## Evals

- `evals/prompts.mjs`: 50 canonical prompts = 10 situations × 5 tones from
  `app/lib/content.js`. Stable IDs (`<situation>__<tone>`), never renumbered.
- `evals/run.mjs` CLI: `node evals/run.mjs --label "opus5+gptimage1-med"`
  runs all 50 (or `--limit N --provider stub` for harness tests) through the
  pipeline, recording per-prompt: final image, iterations, full trace, timing,
  cost breakdown, critic verdicts.
- Runs are append-only rows; a run snapshot stores the full config JSON so
  any grid column is reproducible.

## Admin UI (box-only)

- `/admin` — run list: label, date, config, progress, total/avg cost, failures.
- `/admin/grid` — **the visual comparison grid**: prompts as rows, selected
  runs as columns, image thumbnails side by side with per-cell cost/iterations.
  This is the primary QA surface over time.
- `/admin/runs/[id]` — one run in depth: every generation, trace, candidates.
- Images served through a path-validated admin route handler.

## Optimization loop (agentic, built)

- **Prompt-sets are versioned data** (`prompt_sets` table, seeded v1): the
  orchestrator/critic system prompts live in the DB; every run pins the
  version it used (`--prompt-set N` in `evals/run.mjs`).
- **Format policy is a run dimension** (`--format-policy real|real-ip-safe|freeform`):
  "real" constrains generations to the app's recognizable meme-format catalog
  (43 formats; ip-safe subset excludes franchise/celebrity IP) and makes the
  critic reject non-faithful renditions — so the real-format-fidelity vs
  freeform-variety trade behavior is measured in the grid, not decided by fiat.
- **Optimizer agent** (`npm run optimize -- --from-run N`): a Claude agent
  that inspects a finished run's images and traces (vision), diagnoses
  systematic prompt weaknesses, stores an improved prompt-set version with a
  rationale and parent lineage, then launches the follow-up eval run itself.
  The improvement loop is: run → optimize → run → compare columns in the grid.
  Humans/dev sessions invoke the optimizer; they do not do its analysis.

## Phase 2 (not in this build)

- Wire public Vercel traffic to the agentic pipeline (queue on the box or a
  hosted worker) once quality/cost is proven in evals.

## Invariant

This session builds the factory. Any one-off generation or eval run performed
during development is scaffolding verification, not progress.
