#!/usr/bin/env node
// Show or set cost caps.
//   node agentic/budget-cli.mjs
//   node agentic/budget-cli.mjs --set monthly_cap_usd 100
import path from "path";
import { fileURLToPath } from "url";
process.chdir(path.dirname(path.dirname(fileURLToPath(import.meta.url))));

const b = await import("./budget.js");
const i = process.argv.indexOf("--set");
if (i >= 0) {
  b.setCap(process.argv[i + 1], Number(process.argv[i + 2]));
  console.log(`set ${process.argv[i + 1]} = ${process.argv[i + 2]}`);
}
const caps = b.getCaps();
const out = { caps };
for (const cat of b.CATEGORIES) {
  const spent = b.monthToDateSpend(cat);
  out[cat] = {
    monthToDateUsd: Number(spent.toFixed(2)),
    remainingUsd: Number((caps[`monthly_cap_${cat}_usd`] - spent).toFixed(2)),
  };
}
console.log(JSON.stringify(out, null, 2));
