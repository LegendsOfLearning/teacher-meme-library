# Teacher Meme Generator

A funny, school-safe meme generator for teachers, by Legends of Learning.

Pick a teacher situation, pick a tone, get a real meme in two clicks.
20 actual famous meme formats, captions written for the people who
survived 5th period.

## What's different

Unlike generic meme generators, this app:

- Is designed **specifically for teachers**.
- Uses **20 real recognizable meme formats** (Drake, Distracted
  Boyfriend, Two Buttons, Expanding Brain, Doge, etc.) — each rendered
  with the right per-zone text styling (Drake's black-on-cream panels,
  SpongeBob's mIxEd cAsE, Doge's lowercase Comic Sans, etc.).
- Auto-suggests **funny teacher-specific captions**.
- Saves every generated meme to a **permanent shareable URL**
  (`/meme/<id>`) with full Open Graph + Twitter card metadata.
- Runs every caption through a **multi-step agentic workflow** so we
  pick the funniest, brand-safe option every time.

## The agentic workflow

`app/lib/workflow.js` implements the brief's pipeline. Every meme
generation runs through:

| Step | What it does |
| ---- | ------------ |
| 1 | Pick the meme format (user choice or situation-aware auto-pick). |
| 2 | Confirm the chosen template fits. |
| 3 | _Implicit_ — situation→format mapping is curated, so step 3 is a no-op. |
| 4 | Generate **10 caption candidates** filling the format's text zones. |
| 5 | Score each candidate on **funniness, relatability, clarity, brand-safety, shareability**. |
| 6 | Pick the highest-scoring candidate that passes the brand-safety bar. |
| 7 | Render the final meme with the chosen captions. |
| 8 | **Adversarial review**: a stricter K-8 brand check (blocklist + OpenAI moderation + LLM brand reviewer). If it fails, roll back to the next-best caption and re-render. |
| 9 | Persist permanently (PNG + JSON metadata + share URL). |

Every step is logged to the meme's `trace` array so we can audit each
agent decision after the fact.

The pipeline is **modular and model-agnostic** — `app/lib/llm.js` is
the only place that knows about OpenAI today. Swap that one file out
to use Claude Code SDK / Cursor Agent SDK / Anthropic / local LLMs.

If `OPENAI_API_KEY` is missing the workflow **degrades gracefully** to
hand-curated baked-in captions and heuristic scoring, so the prototype
is fully usable offline.

## Architecture

```
app/
├── page.js                  Mobile-first generator UI
├── meme/[id]/page.js        Permanent share page (server component, OG meta)
├── meme/[id]/ShareActions.js Client share buttons
├── api/
│   ├── generate/route.js    POST → run agentic workflow
│   ├── edit/route.js        POST → user-edited captions, still runs safety
│   └── moderate-text/...    Standalone text-moderation endpoint
└── lib/
    ├── meme-formats.js      Registry of 20 formats with per-zone text geometry
    ├── content.js           10 situations + 5 tones from the brief
    ├── workflow.js          The 9-step agentic pipeline
    ├── llm.js               Model-agnostic LLM adapter (OpenAI today)
    ├── render.js            sharp + SVG meme renderer
    ├── storage.js           Meme persistence (local disk / Vercel Blob)
    ├── moderation.js        OpenAI omni-moderation wrapper
    └── blocklist.js         Fast local blocklist with leet-speak fuzzing

public/
├── templates-meme/          The 20 meme template JPEGs (see CREDITS.md)
├── memes/<id>.png           Saved generated memes
└── legends-logo-white.png   Watermark applied to every meme

data/memes/<id>.json         Saved meme metadata + agentic trace
```

## Getting started

```bash
# Configure OpenAI (optional but strongly recommended)
cp .env.example .env.local
# edit OPENAI_API_KEY=sk-...

# Install + run
npm install
npm run dev
# → open http://localhost:3001
```

## Deploy (Vercel)

See **[DEPLOY.md](./DEPLOY.md)** for step-by-step instructions (CLI or GitHub import),
environment variables, and MVP limitations on Vercel.

### Scripts

- `npm run dev` – dev server on port 3001.
- `npm run build` / `npm run start` – production build.
- `npm run smoke:render` – render every format with its first baked-in
  caption to `tmp-smoke/`. Useful for visually verifying the renderer
  after editing template geometry.

## Adding a new meme format

1. Drop the source JPEG into `public/templates-meme/<id>.jpg`.
2. Append a new entry to `memeFormats` in `app/lib/meme-formats.js`:
   - `id`, `name`, `file`, `width`, `height`, `description`.
   - One `zones[]` entry per text slot, with `x/y/w/h` as fractions of
     the image, an `align`, a `style`, and an optional `maxFontSize`.
   - At least 5 `exampleCaptions` so the LLM has few-shot examples
     AND the offline fallback works.
3. (Optional) Map the new format to relevant situations in
   `SITUATION_TO_FORMATS`.
4. Run `npm run smoke:render` and inspect the output.

## Safety

This is a K-8 branded product, so every published caption goes through:

1. Local blocklist with fuzzy/leet-speak matching.
2. OpenAI `omni-moderation-latest` with stricter-than-default thresholds.
3. LLM-based adversarial brand review specifically tuned for K-8
   (rejects political content, real-person references, brand risk,
   stereotypes, mockery of students, etc.).

The same pipeline runs whether the user generated the caption or
typed it themselves via the Edit panel.
