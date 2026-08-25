import { NextResponse } from "next/server";
import { findBlockedTerm } from "../../lib/blocklist";
import { describeBlock, moderateText } from "../../lib/moderation";
import { generateMeme } from "../../lib/workflow";
import { agenticEnabled, agenticGenerateMeme } from "../../lib/agentic-generate";
import { getSituationById, getToneById } from "../../lib/content";
import { getFormatById } from "../../lib/meme-formats";

// Wraps generateMeme() in input validation, blocklist + moderation
// guards on the user-supplied situation, and consistent error shapes.

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const {
      situationId,
      toneId,
      formatId,
      customSituation,
      excludeFormatIds,
    } = body || {};

    const situation = getSituationById(situationId);
    if (!situation) {
      return NextResponse.json(
        { error: "Pick a teacher situation first." },
        { status: 400 }
      );
    }
    const tone = getToneById(toneId);
    if (!tone) {
      return NextResponse.json(
        { error: "Pick a tone." },
        { status: 400 }
      );
    }
    if (formatId && formatId !== "auto" && !getFormatById(formatId)) {
      return NextResponse.json(
        { error: "Unknown meme format." },
        { status: 400 }
      );
    }

    // If the user supplied a free-form situation, sanity-check it
    // before letting it hit the LLM. (The picker only uses the
    // situationId, but we still pass the freeform text as extra
    // context downstream — so it has to be safe.)
    if (customSituation) {
      const term = findBlockedTerm(customSituation);
      if (term) {
        return NextResponse.json(
          {
            error:
              "Please rephrase your situation without that language — this tool is school-safe.",
          },
          { status: 400 }
        );
      }
      const mod = await moderateText(customSituation);
      if (!mod.ok) {
        return NextResponse.json(
          {
            error:
              describeBlock(mod) ||
              "That situation doesn't meet our community guidelines.",
          },
          { status: 400 }
        );
      }
    }

    // AGENTIC_GENERATE=true routes generation through the agentic pipeline
    // (cost-routed model ladder + adversarial critic, ACTIVE prompt-set
    // snapshot). Off by default; the classic workflow remains the fallback
    // on any agentic failure so users always get a meme.
    if (agenticEnabled()) {
      try {
        const record = await agenticGenerateMeme({
          situation,
          tone,
          formatId,
          excludeFormatIds: Array.isArray(excludeFormatIds)
            ? excludeFormatIds
            : [],
        });
        return NextResponse.json(record);
      } catch (e) {
        if (e.code === "RUNTIME_BUDGET_EXHAUSTED") {
          return NextResponse.json(
            { error: "Meme generation is taking a breather — try again soon." },
            { status: 429 }
          );
        }
        console.error("Agentic generation failed; falling back to classic:", e);
      }
    }

    const record = await generateMeme({
      situationId,
      toneId,
      formatId,
      excludeFormatIds: Array.isArray(excludeFormatIds)
        ? excludeFormatIds
        : [],
    });

    return NextResponse.json(record);
  } catch (e) {
    console.error("Meme generation error:", e);
    const status =
      e.code === "ADVERSARIAL_VETO" || e.code === "ADVERSARIAL_VETO_ALL"
        ? 422
        : 500;
    return NextResponse.json(
      { error: e.message || "Internal error", code: e.code || null },
      { status }
    );
  }
}
