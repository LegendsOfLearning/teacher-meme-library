#!/usr/bin/env node
// Prompt-set management.
//   node agentic/prompt-cli.mjs                  # list (ACTIVE clearly marked)
//   node agentic/prompt-cli.mjs --promote 4      # make a set ACTIVE
// Promotion also writes agentic/active-prompts.json — the committed snapshot
// the Vercel frontend uses (serverless can't reach the box DB).
import path from "path";
import { fileURLToPath } from "url";
process.chdir(path.dirname(path.dirname(fileURLToPath(import.meta.url))));

const store = await import("./prompt-store.js");
const i = process.argv.indexOf("--promote");
if (i >= 0) {
  const snap = store.promoteActive(Number(process.argv[i + 1]));
  console.log(`promoted prompt set ${snap.promptSetId} "${snap.label}" to ACTIVE; snapshot written to agentic/active-prompts.json`);
}
for (const s of store.listPromptSets()) {
  console.log(
    `${s.is_active ? "ACTIVE →" : "        "} #${s.id} "${s.label}" (source=${s.source}${s.parent_id ? `, parent=#${s.parent_id}` : ""}) ${s.created_at.slice(0, 16)}`
  );
}
