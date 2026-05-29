// Install bundled meme fonts BEFORE sharp/librsvg initializes fontconfig.
// Import this module before `import sharp from "sharp"` in render.js.
//
// Local dev: copy into the OS user-fonts dir (Core Text / fontconfig).
// Vercel/Lambda: copy into /tmp and point FONTCONFIG_FILE at that dir —
// ~/.fonts is often read-only or not scanned in serverless runtimes.

import path from "node:path";
import os from "node:os";
import {
  existsSync,
  mkdirSync,
  copyFileSync,
  writeFileSync,
  statSync,
} from "node:fs";

export const BUNDLED_FONTS = [
  "Impact.ttf",
  "Anton-Regular.ttf",
  "ComicNeue-Bold.ttf",
];

function isServerless() {
  return Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
}

function fontsDestDir() {
  if (isServerless()) {
    return path.join(os.tmpdir(), "meme-generator-fonts");
  }
  if (process.platform === "darwin") {
    return path.join(os.homedir(), "Library", "Fonts");
  }
  return path.join(os.homedir(), ".fonts");
}

function shouldRecopy(src, dst) {
  if (!existsSync(dst)) return true;
  try {
    return statSync(src).mtimeMs > statSync(dst).mtimeMs;
  } catch {
    return true;
  }
}

function configureFontconfig(fontDir) {
  const confPath = path.join(os.tmpdir(), "meme-generator-fonts.conf");
  const cacheDir = path.join(os.tmpdir(), "meme-generator-fontconfig-cache");
  mkdirSync(cacheDir, { recursive: true });
  const impactPath = path.join(fontDir, "Impact.ttf");
  const antonPath = path.join(fontDir, "Anton-Regular.ttf");
  const comicPath = path.join(fontDir, "ComicNeue-Bold.ttf");
  writeFileSync(
    confPath,
    `<?xml version="1.0"?>
<!DOCTYPE fontconfig SYSTEM "fonts.dtd">
<fontconfig>
  <dir>${fontDir}</dir>
  <cachedir>${cacheDir}</cachedir>
  <match target="pattern">
    <test qual="any" name="family"><string>Impact</string></test>
    <edit name="file" mode="assign" binding="strong"><string>${impactPath}</string></edit>
    <edit name="family" mode="assign" binding="strong"><string>Impact</string></edit>
  </match>
  <match target="pattern">
    <test qual="any" name="family"><string>Anton</string></test>
    <edit name="file" mode="assign" binding="strong"><string>${antonPath}</string></edit>
  </match>
  <match target="pattern">
    <test qual="any" name="family"><string>Comic Neue</string></test>
    <edit name="file" mode="assign" binding="strong"><string>${comicPath}</string></edit>
  </match>
</fontconfig>`
  );
  process.env.FONTCONFIG_FILE = confPath;
  process.env.FONTCONFIG_PATH = confPath;
}

function installFontsSync() {
  const srcDir = path.join(process.cwd(), "public", "fonts");
  const dstDir = fontsDestDir();

  try {
    mkdirSync(dstDir, { recursive: true });
  } catch (err) {
    console.warn(`[fonts] could not create ${dstDir}: ${err.message}`);
    return;
  }

  let installed = 0;
  for (const name of BUNDLED_FONTS) {
    const src = path.join(srcDir, name);
    const dst = path.join(dstDir, name);
    if (!existsSync(src)) {
      console.warn(`[fonts] missing bundled font: ${src}`);
      continue;
    }
    try {
      if (shouldRecopy(src, dst)) copyFileSync(src, dst);
      installed++;
    } catch (err) {
      console.warn(`[fonts] failed to install ${name}: ${err.message}`);
    }
  }

  if (installed === 0) {
    console.warn("[fonts] no fonts installed — captions will render as tofu");
    return;
  }

  if (isServerless()) {
    configureFontconfig(dstDir);
  }
}

installFontsSync();

export function ensureFontsInstalled() {
  installFontsSync();
  return Promise.resolve();
}
