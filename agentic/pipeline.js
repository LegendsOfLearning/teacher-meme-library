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
} from "./prompt-store.js";
import { templateCatalog, renderTemplate } from "./template-render.js";
import { assertBudget, recordSpend } from "./budget.js";

// Bumped whenever the pipeline's behavior changes; stamped into every
// generation's provenance so results are traceable to the code that made them.
export const PIPELINE_VERSION = "2.1.0";

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
      system: orchestratorSystem,
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
        system: criticSystem,
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
