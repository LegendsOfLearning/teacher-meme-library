#!/usr/bin/env node
// Blocklist regression tests — run: node scripts/test-blocklist.mjs

import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(root);

const { findBlockedTerm } = await import("../app/lib/blocklist.js");

const MUST_BLOCK = [
  "leet f*ck",
  "f.u.c.k",
  "fvck this",
  "sh1t",
  "fuuuuck",
  "kill yourself",
  "f\u0430sshole",
  "puta madre",
  "f u c k",
];

const MUST_ALLOW = [
  "My class finally read the syllabus",
  "Grading 87 papers tonight",
  "The copier works but I am out of paper",
  "Lesson plan vs one off-topic question",
  "computadora",
  "analyze the data",
];

let failed = 0;

for (const input of MUST_BLOCK) {
  const hit = findBlockedTerm(input);
  if (!hit) {
    console.error(`FAIL (should block): "${input}"`);
    failed++;
  }
}

for (const input of MUST_ALLOW) {
  const hit = findBlockedTerm(input);
  if (hit) {
    console.error(`FAIL (false positive): "${input}" -> "${hit}"`);
    failed++;
  }
}

if (failed > 0) {
  console.error(`\n${failed} blocklist test(s) failed.`);
  process.exit(1);
}

console.log(`Blocklist tests passed (${MUST_BLOCK.length} blocks, ${MUST_ALLOW.length} allows).`);
