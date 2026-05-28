import { NextResponse } from "next/server";
import { moderateText } from "../../lib/moderation";
import {
  hasOpenAIKey,
  saveBlockedWithoutApi,
} from "../../lib/moderation-policy";

export const runtime = "nodejs";

/** GET — diagnose OpenAI moderation setup (no secrets returned). */
export async function GET() {
  try {
    if (saveBlockedWithoutApi()) {
      return NextResponse.json({
        ok: false,
        openaiKeyConfigured: false,
        status: "not_configured",
        hint: "Add OPENAI_API_KEY in Vercel → Settings → Environment Variables → Production, then Redeploy.",
      });
    }

    const mod = await moderateText("Safe teacher classroom meme test.");

    if (mod.ok && !mod.skipped) {
      return NextResponse.json({
        ok: true,
        openaiKeyConfigured: true,
        status: "ok",
        hint: "Moderation API is working. Customize save should work.",
      });
    }

    if (mod.ok && mod.skipped) {
      return NextResponse.json({
        ok: false,
        openaiKeyConfigured: hasOpenAIKey(),
        status: "skipped",
        reason: mod.reason,
        hint: "Key is set but moderation was skipped. Check OPENAI_API_KEY value and redeploy.",
      });
    }

    return NextResponse.json({
      ok: false,
      openaiKeyConfigured: hasOpenAIKey(),
      status: mod.category || "error",
      reason: mod.reason,
      detail: mod.error ? String(mod.error).slice(0, 400) : undefined,
      hint: hintForModerationFailure(mod),
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        status: "handler_error",
        detail: err?.message ? String(err.message).slice(0, 200) : "Unknown error",
      },
      { status: 500 }
    );
  }
}

function hintForModerationFailure(mod) {
  const detail = String(mod.error || "").toLowerCase();
  if (detail.includes("401") || detail.includes("invalid")) {
    return "Invalid API key — create a new key at platform.openai.com and update Vercel, then Redeploy.";
  }
  if (detail.includes("429") || detail.includes("quota") || detail.includes("billing")) {
    return "OpenAI quota or billing issue — add payment method at platform.openai.com/settings/billing.";
  }
  if (mod.reason === "network_error") {
    return "Network error reaching OpenAI — retry in a minute or check OpenAI status page.";
  }
  return "OpenAI moderation failed — see detail above, fix in Vercel env vars, then Redeploy.";
}
