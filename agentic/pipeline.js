// Agentic meme pipeline — EXISTING MEMES ONLY.
//
// The pipeline never creates novel imagery. Claude picks a real meme format
// from the app's template catalog, writes captions for its zones, renders
// through the app's own template renderer (production code path, $0), then
// SEES the rendered PNG and iterates: black bars / letterboxing, text
// overflow, illegible sizing, wrong zone usage, weak jokes. A fresh-context
// adversarial critic must approve the finalized meme or the loop resumes.
//
// Every API call lands in a cost ledger. The caller persists everything.
import Anthropic from "@anthropic-ai/sdk";
import sharp from "sharp";
import { anthropicCallCost } from "./pricing.js";
import {
  SEED_ORCHESTRATOR_SYSTEM,
  SEED_CRITIC_SYSTEM,
  SEED_WRITER_SYSTEM,
} from "./prompt-store.js";
import { templateCatalog, renderTemplate, getFormat } from "./template-render.js";
import { lintRender, PILLARBOX_FORMAT_IDS } from "./render-lint.js";
import { assertBudget, recordSpend } from "./budget.js";

// Bumped whenever the pipeline's behavior changes; stamped into every
// generation's provenance so results are traceable to the code that made them.
export const PIPELINE_VERSION = "2.2.0";

// Every system prompt in this file is a long, byte-stable prefix reused across
// calls and across memes — exactly what prompt caching is for. Sending it as a
// cached text block turns repeat sends into 0.1x reads.
function cachedSystem(text) {
  return [{ type: "text", text, cache_control: { type: "ephemeral" } }];
}

const TOOLS = [
  {
    name: "render_meme",
    description:
      "Render captions onto one of the real meme templates from the catalog. Returns the rendered meme for your inspection plus its candidate id.",
    input_schema: {
      type: "object",
      properties: {
        format_id: {
          type: "string",
          description: "A format id from the catalog.",
        },
        captions: {
          type: "object",
          description:
            "Zone key -> caption text, using exactly the zone keys listed for that format.",
          additionalProperties: { type: "string" },
        },
      },
      required: ["format_id", "captions"],
      additionalProperties: false,
    },
  },
  {
    name: "finalize",
    description: "Select the winning candidate.",
    input_schema: {
      type: "object",
      properties: {
        candidate_id: { type: "integer" },
        rationale: { type: "string" },
      },
      required: ["candidate_id", "rationale"],
      additionalProperties: false,
    },
  },
];

async function toVisionBlock(png) {
  const small = await sharp(png)
    .resize(512, 512, { fit: "inside" })
    .png()
    .toBuffer();
  return {
    type: "image",
    source: {
      type: "base64",
      media_type: "image/png",
      data: small.toString("base64"),
    },
  };
}

/**
 * Run one agentic generation over existing meme templates.
 * @param {object} brief {situation, tone, captionIdea, formatHint}
 * @param {object} config {orchestratorModel, criticModel, maxRenders, maxCriticRounds, maxUsd, ipSafeOnly, prompts:{orchestrator_system, critic_system}, budgetCategory}
 * @returns {finalPng, formatId, captions, candidates, ledger, trace, costUsd, approved}
 */
export async function runAgenticGeneration(brief, config = {}) {
  const cfg = {
    orchestratorModel: "claude-opus-5",
    criticModel: "claude-opus-5",
    maxRenders: 6,
    maxCriticRounds: 2,
    maxUsd: 2.0,
    ipSafeOnly: false,
    avoidFormats: [],
    ...config,
  };
  if (cfg.budgetCategory === "runtime") {
    assertBudget(cfg.maxUsd, "pipeline runtime generation", "runtime");
  }
  const orchestratorSystem = `${
    cfg.prompts?.orchestrator_system || SEED_ORCHESTRATOR_SYSTEM
  }\n\nFORMAT CATALOG (real memes — you must use one of these):\n${templateCatalog({ ipSafe: cfg.ipSafeOnly })}`;
  const criticSystem = cfg.prompts?.critic_system || SEED_CRITIC_SYSTEM;

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const ledger = [];
  const trace = [];
  const candidates = [];
  const totalUsd = () => ledger.reduce((s, e) => s + e.usd, 0);
  const recordRuntimeSpend = () => {
    if (cfg.budgetCategory === "runtime") {
      recordSpend("pipeline:runtime", totalUsd(), { category: "runtime" });
    }
  };

  const briefText = `Meme brief:
- Teacher situation: ${brief.situation}
- Tone: ${brief.tone}
- Caption/joke direction: ${brief.captionIdea || "invent the funniest school-safe take"}
${brief.formatHint ? `- Required format: ${brief.formatHint}` : "- Format: pick the catalog format whose joke structure best fits."}
${
  cfg.avoidFormats?.length && !brief.formatHint
    ? `- Variety constraint: recent memes in this batch already used these formats — do NOT use them unless no other format can carry the joke: ${cfg.avoidFormats.join(", ")}.\n`
    : ""
}Begin.`;

  const messages = [{ role: "user", content: briefText }];
  let finalized = null;
  let renders = 0;
  let criticRounds = 0;

  while (true) {
    if (totalUsd() >= cfg.maxUsd) {
      trace.push({ step: "budget_exhausted", usd: totalUsd() });
      break;
    }
    const response = await anthropic.messages.create({
      model: cfg.orchestratorModel,
      max_tokens: 4000,
      system: cachedSystem(orchestratorSystem),
      tools: TOOLS,
      messages,
    });
    ledger.push({
      step: "orchestrator",
      api: "anthropic",
      model: cfg.orchestratorModel,
      usage: response.usage,
      usd: anthropicCallCost(cfg.orchestratorModel, response.usage),
    });
    messages.push({ role: "assistant", content: response.content });

    if (response.stop_reason !== "tool_use") {
      trace.push({ step: "orchestrator_stopped", reason: response.stop_reason });
      break;
    }

    const toolResults = [];
    for (const block of response.content) {
      if (block.type !== "tool_use") continue;
      if (block.name === "render_meme") {
        renders += 1;
        if (renders > cfg.maxRenders) {
          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            content:
              "Render budget exhausted. Call finalize with the best existing candidate.",
          });
          continue;
        }
        const { format_id, captions } = block.input;
        trace.push({ step: "render", n: renders, format_id, captions });
        try {
          const { png } = await renderTemplate(format_id, captions);
          const id = candidates.length + 1;
          candidates.push({ id, formatId: format_id, captions, png });
          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: [
              await toVisionBlock(png),
              {
                type: "text",
                text: `candidate_id: ${id} (render ${renders}/${cfg.maxRenders}). Inspect: letterboxing/black bars, text overflow or cut-off, legibility, zone correctness, joke quality.`,
              },
            ],
          });
        } catch (e) {
          trace.push({ step: "render_error", n: renders, error: e.message });
          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            is_error: true,
            content: `Render failed: ${e.message}`,
          });
        }
      } else if (block.name === "finalize") {
        finalized = candidates.find((c) => c.id === block.input.candidate_id);
        trace.push({
          step: "finalize",
          candidate_id: block.input.candidate_id,
          rationale: block.input.rationale,
          found: Boolean(finalized),
        });
        toolResults.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: finalized
            ? "Finalized. Awaiting adversarial review."
            : "Unknown candidate_id.",
        });
      }
    }
    messages.push({ role: "user", content: toolResults });

    if (finalized) {
      const verdictRes = await anthropic.messages.create({
        model: cfg.criticModel,
        max_tokens: 1000,
        system: cachedSystem(criticSystem),
        messages: [
          {
            role: "user",
            content: [
              await toVisionBlock(finalized.png),
              {
                type: "text",
                text: `Intended: ${brief.situation} / ${brief.tone}. Format: ${finalized.formatId}. Captions: ${JSON.stringify(finalized.captions)}`,
              },
            ],
          },
        ],
      });
      ledger.push({
        step: `critic_${criticRounds + 1}`,
        api: "anthropic",
        model: cfg.criticModel,
        usage: verdictRes.usage,
        usd: anthropicCallCost(cfg.criticModel, verdictRes.usage),
      });
      let verdict = { approve: false, issues: ["unparseable critic output"] };
      try {
        const raw = verdictRes.content.find((b) => b.type === "text")?.text || "";
        verdict = JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] || raw);
      } catch {}
      trace.push({ step: "adversarial_review", round: criticRounds + 1, verdict });
      criticRounds += 1;
      const result = {
        finalPng: finalized.png,
        formatId: finalized.formatId,
        captions: finalized.captions,
        candidates,
        ledger,
        trace,
        costUsd: totalUsd(),
        provenance: {
          pipelineVersion: PIPELINE_VERSION,
          engine: "agentic",
          promptSetId: cfg.promptSetId ?? null,
          orchestratorModel: cfg.orchestratorModel,
          criticModel: cfg.criticModel,
        },
      };
      if (verdict.approve) {
        recordRuntimeSpend();
        return { ...result, approved: true };
      }
      if (criticRounds >= cfg.maxCriticRounds || renders >= cfg.maxRenders) {
        recordRuntimeSpend();
        return { ...result, approved: false };
      }
      messages.push({
        role: "user",
        content: `Adversarial reviewer REJECTED the finalized meme. Issues: ${JSON.stringify(verdict.issues)}. Fix these with further renders (different captions or a better-fitting format), then finalize again.`,
      });
      finalized = null;
    }
  }

  recordRuntimeSpend();
  const best = finalized || candidates[candidates.length - 1] || null;
  return {
    finalPng: best?.png || null,
    formatId: best?.formatId || null,
    captions: best?.captions || null,
    candidates,
    ledger,
    trace,
    costUsd: totalUsd(),
    approved: false,
    provenance: {
      pipelineVersion: PIPELINE_VERSION,
      engine: "agentic",
      promptSetId: cfg.promptSetId ?? null,
      orchestratorModel: cfg.orchestratorModel,
      criticModel: cfg.criticModel,
    },
  };
}

// ---------------------------------------------------------------------------
// Cheap engine: code composes AND code checks; AI only writes and takes one
// final look.
//
// The agentic engine spends most of its money having a frontier model LOOK at
// every candidate to answer questions that are not actually questions of taste
// — is there a pillar bar, is a zone empty, does this caption fit. All of that
// is now decided by agentic/render-lint.js in code for $0. What is left for a
// model: writing the joke (cheap, text-only, no images ever) and one final
// look at the finished meme (the only genuinely subjective call).
// ---------------------------------------------------------------------------

const WRITER_TOOLS = [
  {
    name: "write_meme",
    description:
      "Submit the chosen format and the caption for each of its zones. This is the only way to answer.",
    input_schema: {
      type: "object",
      properties: {
        format_id: { type: "string", description: "A format id from the catalog." },
        captions: {
          type: "object",
          description:
            "Zone key -> caption text, using exactly the zone keys listed for that format.",
          additionalProperties: { type: "string" },
        },
        twist: {
          type: "string",
          description:
            "The punchline's twist in one line: the specific teacher moment this meme is about.",
        },
      },
      required: ["format_id", "captions", "twist"],
      additionalProperties: false,
    },
  },
];

/**
 * Run one generation with the cheap harness.
 * @param {object} brief {situation, tone, captionIdea, formatHint}
 * @param {object} config {writerModel, criticModel, maxWriterRounds, maxVisionChecks, maxUsd, ipSafeOnly, avoidFormats, prompts:{writer_system, critic_system}, budgetCategory}
 * @returns same shape as runAgenticGeneration
 */
export async function runCheapGeneration(brief, config = {}) {
  const cfg = {
    writerModel: "claude-haiku-4-5",
    criticModel: "claude-opus-5",
    maxWriterRounds: 3,
    maxVisionChecks: 2,
    maxUsd: 0.5,
    ipSafeOnly: false,
    avoidFormats: [],
    ...config,
  };
  if (cfg.budgetCategory === "runtime") {
    assertBudget(cfg.maxUsd, "pipeline cheap generation", "runtime");
  }

  const writerSystem = `${
    cfg.prompts?.writer_system || SEED_WRITER_SYSTEM
  }\n\nFORMAT CATALOG (real memes — you must use one of these):\n${templateCatalog(
    { ipSafe: cfg.ipSafeOnly }
  )}\n\nGEOMETRY (already measured in code, not up for debate): these formats cannot fill the square canvas and always render with solid side pillars, so the linter rejects them on sight — never pick them: ${PILLARBOX_FORMAT_IDS.join(", ")}.`;
  const criticSystem = cfg.prompts?.critic_system || SEED_CRITIC_SYSTEM;

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const ledger = [];
  const trace = [];
  const candidates = [];
  const totalUsd = () => ledger.reduce((s, e) => s + e.usd, 0);
  const recordRuntimeSpend = () => {
    if (cfg.budgetCategory === "runtime") {
      recordSpend("pipeline:runtime", totalUsd(), { category: "runtime" });
    }
  };

  const briefText = `Meme brief:
- Teacher situation: ${brief.situation}
- Tone: ${brief.tone}
- Caption/joke direction: ${brief.captionIdea || "invent the funniest school-safe take"}
${brief.formatHint ? `- Required format: ${brief.formatHint}` : "- Format: pick the catalog format whose joke structure best fits."}
${
  cfg.avoidFormats?.length && !brief.formatHint
    ? `- Variety constraint: recent memes in this batch already used these formats — do NOT use them unless no other format can carry the joke: ${cfg.avoidFormats.join(", ")}.\n`
    : ""
}Write the meme.`;

  // Seeded by the first writerTurn below.
  const messages = [];
  let writerCalls = 0;
  let visionChecks = 0;

  // One writer call. Text only — the writer never sees an image.
  async function writerTurn(userContent) {
    messages.push(userContent);
    const res = await anthropic.messages.create({
      model: cfg.writerModel,
      max_tokens: 1200,
      system: cachedSystem(writerSystem),
      tools: WRITER_TOOLS,
      tool_choice: { type: "tool", name: "write_meme" },
      messages,
    });
    writerCalls += 1;
    ledger.push({
      step: `writer_${writerCalls}`,
      api: "anthropic",
      model: cfg.writerModel,
      usage: res.usage,
      usd: anthropicCallCost(cfg.writerModel, res.usage),
    });
    messages.push({ role: "assistant", content: res.content });
    const block = res.content.find(
      (b) => b.type === "tool_use" && b.name === "write_meme"
    );
    if (!block) {
      trace.push({ step: "writer_no_tool_call", n: writerCalls, stop: res.stop_reason });
      return null;
    }
    return {
      toolUseId: block.id,
      formatId: block.input.format_id,
      captions: block.input.captions || {},
      twist: block.input.twist,
    };
  }

  // Render + deterministic lint. Costs nothing; the whole point of the engine.
  async function renderAndLint(draft) {
    let png;
    try {
      ({ png } = await renderTemplate(draft.formatId, draft.captions));
    } catch (e) {
      trace.push({ step: "render_error", n: writerCalls, error: e.message });
      return { error: e.message };
    }
    const lint = await lintRender({
      png,
      format: getFormat(draft.formatId),
      captions: draft.captions,
    });
    const candidate = {
      id: candidates.length + 1,
      formatId: draft.formatId,
      captions: draft.captions,
      twist: draft.twist,
      toolUseId: draft.toolUseId,
      png,
      lint,
    };
    candidates.push(candidate);
    trace.push({
      step: "lint",
      n: candidate.id,
      format_id: draft.formatId,
      captions: draft.captions,
      twist: draft.twist,
      ok: lint.ok,
      blocking: lint.blocking,
      notes: lint.notes,
      metrics: lint.metrics,
    });
    return { candidate, lint };
  }

  function lintFeedback(toolUseId, lint, renderError) {
    return {
      role: "user",
      content: [
        {
          type: "tool_result",
          tool_use_id: toolUseId,
          content: renderError
            ? `Render failed: ${renderError}. Use a valid format id and only that format's zone keys.`
            : `The deterministic linter REJECTED this render. Fix exactly these, change nothing else:\n${JSON.stringify(
                { blocking: lint.blocking, notes: lint.notes },
                null,
                1
              )}`,
        },
      ],
    };
  }

  // --- Stage 1: write → render → lint, until the lint is clean or rounds run out.
  let draft = await writerTurn({ role: "user", content: briefText });
  let current = null;
  while (draft) {
    const { candidate, lint, error } = await renderAndLint(draft);
    if (candidate) current = candidate;
    if (candidate && lint.ok) break;
    if (writerCalls >= cfg.maxWriterRounds || totalUsd() >= cfg.maxUsd) break;
    draft = await writerTurn(lintFeedback(draft.toolUseId, lint, error));
  }

  const buildResult = (approved) => ({
    finalPng: current?.png || null,
    formatId: current?.formatId || null,
    captions: current?.captions || null,
    candidates,
    ledger,
    trace,
    costUsd: totalUsd(),
    approved,
    provenance: {
      pipelineVersion: PIPELINE_VERSION,
      engine: "cheap-harness",
      promptSetId: cfg.promptSetId ?? null,
      writerModel: cfg.writerModel,
      criticModel: cfg.criticModel,
    },
  });

  if (!current || !current.lint.ok) {
    trace.push({ step: "lint_never_cleared", writerCalls });
    recordRuntimeSpend();
    return buildResult(false);
  }

  // --- Stage 2: the one thing code cannot judge — does the joke land?
  while (visionChecks < cfg.maxVisionChecks) {
    if (totalUsd() >= cfg.maxUsd) {
      trace.push({ step: "budget_exhausted", usd: totalUsd() });
      break;
    }
    const verdictRes = await anthropic.messages.create({
      model: cfg.criticModel,
      // Headroom so a verdict is never truncated into unparseable JSON, and
      // low effort because applying a written rubric to one image is not a
      // deep-reasoning task — thinking tokens were the single largest line
      // item in the first smoke run.
      max_tokens: 2000,
      output_config: { effort: "low" },
      system: cachedSystem(criticSystem),
      messages: [
        {
          role: "user",
          content: [
            await toVisionBlock(current.png),
            {
              type: "text",
              text: `Intended: ${brief.situation} / ${brief.tone}. Format: ${current.formatId}. Captions: ${JSON.stringify(current.captions)}`,
            },
          ],
        },
      ],
    });
    visionChecks += 1;
    ledger.push({
      step: `critic_${visionChecks}`,
      api: "anthropic",
      model: cfg.criticModel,
      usage: verdictRes.usage,
      usd: anthropicCallCost(cfg.criticModel, verdictRes.usage),
    });
    let verdict = { approve: false, issues: ["unparseable critic output"] };
    try {
      const raw = verdictRes.content.find((b) => b.type === "text")?.text || "";
      verdict = JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] || raw);
    } catch {}
    trace.push({
      step: "adversarial_review",
      round: visionChecks,
      verdict,
      stop_reason: verdictRes.stop_reason,
    });
    if (verdict.approve) {
      recordRuntimeSpend();
      return buildResult(true);
    }
    if (visionChecks >= cfg.maxVisionChecks || writerCalls >= cfg.maxWriterRounds) break;

    // One revision, then the second and final vision check.
    let revised = await writerTurn({
      role: "user",
      content: [
        {
          type: "tool_result",
          tool_use_id: current.toolUseId,
          content: `The reviewer REJECTED this meme. Issues: ${JSON.stringify(
            verdict.issues
          )}. Rewrite to fix each issue literally and minimally — prefer fixing the copy over switching format.`,
        },
      ],
    });
    let revisedOk = false;
    while (revised) {
      const { candidate, lint, error } = await renderAndLint(revised);
      if (candidate && lint.ok) {
        current = candidate;
        revisedOk = true;
        break;
      }
      if (writerCalls >= cfg.maxWriterRounds || totalUsd() >= cfg.maxUsd) break;
      revised = await writerTurn(lintFeedback(revised.toolUseId, lint, error));
    }
    if (!revisedOk) {
      // The revision never passed the lint; the previously clean candidate
      // stands and there is nothing new to show the critic.
      trace.push({ step: "revision_failed_lint", writerCalls });
      break;
    }
  }

  // Re-roll: at ~$0.03 an attempt, a fresh start on a different format is the
  // cheapest path from a critic rejection to an approved meme.
  if ((cfg.rerolls ?? 1) > 0 && current) {
    trace.push({ step: "reroll", after: current.formatId });
    const retry = await runCheapGeneration(brief, {
      ...cfg,
      rerolls: (cfg.rerolls ?? 1) - 1,
      avoidFormats: [...(cfg.avoidFormats || []), current.formatId],
      budgetCategory: undefined,
      maxUsd: cfg.maxUsd - totalUsd(),
    });
    const merged = {
      ...retry,
      candidates: [...candidates, ...retry.candidates],
      ledger: [...ledger, ...retry.ledger],
      trace: [...trace, ...retry.trace],
    };
    merged.costUsd = merged.ledger.reduce((s, e) => s + e.usd, 0);
    if (cfg.budgetCategory === "runtime") {
      recordSpend("pipeline:runtime", merged.costUsd, { category: "runtime" });
    }
    return merged;
  }

  recordRuntimeSpend();
  return buildResult(false);
}

/**
 * Cost router: run the generation on the cheapest model first and escalate
 * up the ladder only when the adversarial critic refuses to approve.
 * @param {string[]} ladder model ids, cheapest first,
 *   e.g. ["claude-haiku-4-5", "claude-sonnet-5", "claude-opus-5"]
 * @returns the winning tier's result plus {ledger, trace, costUsd} aggregated
 *   across ALL attempted tiers and provenance.escalations.
 */
export async function runRoutedGeneration(brief, config = {}, ladder) {
  const models = ladder?.length ? ladder : ["claude-opus-5"];
  const allLedger = [];
  const allTrace = [];
  let last = null;
  for (let i = 0; i < models.length; i += 1) {
    const model = models[i];
    allTrace.push({ step: "router_attempt", tier: i + 1, model });
    const result = await runAgenticGeneration(brief, {
      ...config,
      orchestratorModel: model,
      // A fixed strong critic gates every tier — same-tier critics are
      // lenient for weak models (proven by judge data, runs 10-12).
      criticModel: config.criticModel || model,
    });
    allLedger.push(...result.ledger);
    allTrace.push(...result.trace);
    last = result;
    if (result.approved) break;
  }
  return {
    ...last,
    ledger: allLedger,
    trace: allTrace,
    costUsd: allLedger.reduce((s, e) => s + e.usd, 0),
    provenance: {
      ...last.provenance,
      router: models,
      escalations: allTrace.filter((t) => t.step === "router_attempt").length - 1,
    },
  };
}
