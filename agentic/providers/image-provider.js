// Image provider seam. "openai" renders with gpt-image-2; "stub" renders a
// free local placeholder so the whole factory (pipeline, evals, grid) runs
// end-to-end without an image API key.
import sharp from "sharp";
import { imageCallCost } from "../pricing.js";

const OPENAI_IMAGES_URL = "https://api.openai.com/v1/images/generations";

async function openaiRender({ prompt, quality, apiKey, model }) {
  const res = await fetch(OPENAI_IMAGES_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      prompt,
      size: "1024x1024",
      quality,
      n: 1,
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`image API ${res.status}: ${text.slice(0, 300)}`);
  }
  const data = await res.json();
  const b64 = data?.data?.[0]?.b64_json;
  if (!b64) throw new Error("image API returned no b64_json");
  const promptTokens = data?.usage?.input_tokens || Math.ceil(prompt.length / 4);
  return {
    png: Buffer.from(b64, "base64"),
    costUsd: imageCallCost(model, quality, promptTokens),
    meta: { provider: "openai", model, quality },
  };
}

async function stubRender({ prompt }) {
  const esc = (s) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const lines = [];
  const words = prompt.split(/\s+/);
  let line = "";
  for (const w of words) {
    if ((line + " " + w).length > 34) {
      lines.push(line.trim());
      line = w;
    } else line += " " + w;
    if (lines.length >= 12) break;
  }
  if (line.trim() && lines.length < 12) lines.push(line.trim());
  const svg = `<svg width="1024" height="1024" xmlns="http://www.w3.org/2000/svg">
    <rect width="1024" height="1024" fill="#3d5a80"/>
    <rect x="24" y="24" width="976" height="976" fill="none" stroke="#e0fbfc" stroke-width="4"/>
    <text x="60" y="90" font-family="sans-serif" font-size="34" fill="#e0fbfc">STUB RENDER</text>
    ${lines
      .map(
        (l, i) =>
          `<text x="60" y="${170 + i * 52}" font-family="sans-serif" font-size="36" fill="#ffffff">${esc(l)}</text>`
      )
      .join("\n")}
  </svg>`;
  return {
    png: await sharp(Buffer.from(svg)).png().toBuffer(),
    costUsd: 0,
    meta: { provider: "stub" },
  };
}

/**
 * @param {object} cfg {provider, model, quality, apiKey}
 * @returns render({prompt}) -> {png, costUsd, meta}
 */
export function makeImageProvider(cfg) {
  const provider =
    cfg?.provider || (process.env.IMAGE_API_KEY ? "openai" : "stub");
  if (provider === "openai") {
    const apiKey = cfg?.apiKey || process.env.IMAGE_API_KEY;
    if (!apiKey) throw new Error("openai image provider needs IMAGE_API_KEY");
    const model = cfg?.model || "gpt-image-2";
    const quality = cfg?.quality || "medium";
    return {
      name: `openai:${model}:${quality}`,
      render: ({ prompt }) => openaiRender({ prompt, quality, apiKey, model }),
    };
  }
  return { name: "stub", render: stubRender };
}
