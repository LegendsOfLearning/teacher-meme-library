// Existing-meme rendering for the agentic loop. The pipeline NEVER creates
// novel imagery: it composites captions onto the app's real meme template
// images via the app's own renderer, exactly like production. The agentic
// value-add is caption/format iteration and visual QA of the result.
import { memeFormats } from "../app/lib/meme-formats.js";
import { IP_SENSITIVE_FORMAT_IDS } from "../app/lib/ip-safe-formats.js";
import { renderMeme } from "../app/lib/render.js";

export function getFormat(formatId) {
  return memeFormats.find((f) => f.id === formatId) || null;
}

/** Catalog text the orchestrator picks from: real formats + their caption zones. */
export function templateCatalog({ ipSafe = false } = {}) {
  return memeFormats
    .filter((f) => !ipSafe || !IP_SENSITIVE_FORMAT_IDS.has(f.id))
    .map((f) => {
      const zones = (f.zones || [])
        .map((z) => `${z.key} (${z.label}${z.maxLines ? `, max ${z.maxLines} lines` : ""})`)
        .join("; ");
      return `- ${f.id}: ${f.name} — ${(f.jokeStructure || f.description || "").slice(0, 220)}\n  zones: ${zones}`;
    })
    .join("\n");
}

/** Render captions onto a real template. Returns {png}. Cost: $0 (local sharp). */
export async function renderTemplate(formatId, captions) {
  const format = getFormat(formatId);
  if (!format) throw new Error(`unknown format_id: ${formatId}`);
  const validKeys = new Set((format.zones || []).map((z) => z.key));
  for (const k of Object.keys(captions || {})) {
    if (!validKeys.has(k)) {
      throw new Error(
        `format ${formatId} has no zone "${k}" (valid: ${[...validKeys].join(", ")})`
      );
    }
  }
  const png = await renderMeme(format, captions || {});
  return { png };
}
