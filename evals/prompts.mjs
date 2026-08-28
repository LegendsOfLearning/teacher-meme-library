// The 50 canonical eval prompts: 10 situations x 5 tones from the app's own
// content. IDs are stable ("<situation>__<tone>") — never renumber; append
// new prompts with new IDs so historical grid columns stay comparable.
import { situations, tones } from "../app/lib/content.js";

// Default per-run subset: 10 prompts, one per situation, tones rotating
// deterministically so every tone appears twice. Stable across runs so
// grid cells stay comparable; --all runs the full 50.
export function sampledPrompts(n = 10) {
  const all = canonicalPrompts();
  const bySituation = new Map();
  for (const p of all) {
    if (!bySituation.has(p.situationId)) bySituation.set(p.situationId, []);
    bySituation.get(p.situationId).push(p);
  }
  const sample = [];
  let i = 0;
  for (const group of bySituation.values()) {
    sample.push(group[i % group.length]);
    i += 1;
    if (sample.length >= n) break;
  }
  return sample;
}

export function canonicalPrompts() {
  const prompts = [];
  for (const s of situations.slice(0, 10)) {
    for (const t of tones) {
      prompts.push({
        id: `${s.id}__${t.id}`,
        situation: s.label || s.id,
        situationId: s.id,
        tone: t.label || t.id,
        toneId: t.id,
        captionIdea: s.description || "",
      });
    }
  }
  return prompts;
}
