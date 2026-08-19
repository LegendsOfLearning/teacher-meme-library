// Format policy: whether generations must reproduce one of the app's REAL
// recognizable meme formats, and whether IP-sensitive ones are allowed.
// Modeled as a run dimension so the grid can compare the trade behavior
// (real-format fidelity vs freeform variety) across runs.
import { memeFormats } from "../app/lib/meme-formats.js";
import { IP_SENSITIVE_FORMAT_IDS } from "../app/lib/ip-safe-formats.js";

export const FORMAT_POLICIES = ["real", "real-ip-safe", "freeform"];

export function formatCatalog(policy) {
  if (policy === "freeform") return null;
  const formats = memeFormats.filter(
    (f) => policy !== "real-ip-safe" || !IP_SENSITIVE_FORMAT_IDS.has(f.id)
  );
  return formats
    .map((f) => `- ${f.id}: ${f.name || f.id} — ${(f.description || "").slice(0, 160)}`)
    .join("\n");
}

export function formatBriefClause(policy) {
  const catalog = formatCatalog(policy);
  if (!catalog) {
    return "Meme format: your choice — invent or adapt any composition that fits.";
  }
  return `Meme format: you MUST pick exactly ONE of these real, recognizable meme formats and reproduce its canonical composition faithfully (same layout, same visual beats — a teacher-world rendition of the real thing). State which format you chose in each render prompt.\n${catalog}`;
}

export function formatCriticClause(policy) {
  if (policy === "freeform") return "";
  return " Additionally REJECT if the image does not clearly read as the specific real meme format the brief required — a generic illustration is a failure even if otherwise clean.";
}
