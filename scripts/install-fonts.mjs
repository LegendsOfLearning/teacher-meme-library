#!/usr/bin/env node
// Ensures bundled meme fonts exist (Anton Regular, Comic Neue, Montserrat).

import { existsSync } from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const fontDir = path.join(process.cwd(), "public", "fonts");
const fonts = [
  {
    name: "Anton-Regular.ttf",
    url: "https://github.com/google/fonts/raw/main/ofl/anton/Anton-Regular.ttf",
  },
  {
    name: "ComicNeue-Bold.ttf",
    url: "https://github.com/google/fonts/raw/main/ofl/comicneue/ComicNeue-Bold.ttf",
  },
  {
    name: "Montserrat-SemiBold.ttf",
    url: "https://github.com/google/fonts/raw/main/ofl/montserrat/static/Montserrat-SemiBold.ttf",
  },
];

for (const { name, url } of fonts) {
  const dest = path.join(fontDir, name);
  if (!existsSync(dest)) {
    execSync(`curl -sL "${url}" -o "${dest}"`, { stdio: "inherit" });
  }
}

console.log("[fonts] bundled meme fonts ready");
