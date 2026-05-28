import { NextResponse } from "next/server";
import { findBlockedTerm, BLOCKLIST_USER_MESSAGE } from "../../lib/blocklist";
import { describeBlock, moderateText } from "../../lib/moderation";
import {
  moderationRequired,
  MODERATION_UNAVAILABLE_MESSAGE,
} from "../../lib/moderation-policy";

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { text } = body;

    const value = typeof text === "string" ? text : "";

    if (!value.trim()) {
      return NextResponse.json({ ok: true, blocked: false });
    }

    const blocked = findBlockedTerm(value);
    if (blocked) {
      return NextResponse.json(
        {
          ok: false,
          blocked: true,
          category: "blocklist",
          message: BLOCKLIST_USER_MESSAGE,
        },
        { status: 400 }
      );
    }

    const moderation = await moderateText(value);
    if (!moderation.ok) {
      return NextResponse.json(
        {
          ok: false,
          blocked: true,
          category: moderation.category,
          message:
            moderation.message ||
            describeBlock(moderation) ||
            "This text doesn't meet our community guidelines.",
        },
        { status: 400 }
      );
    }
    if (moderation.skipped && moderationRequired()) {
      return NextResponse.json(
        {
          ok: false,
          blocked: true,
          category: "moderation_unavailable",
          message: MODERATION_UNAVAILABLE_MESSAGE,
        },
        { status: 503 }
      );
    }

    return NextResponse.json({ ok: true, blocked: false });
  } catch (error) {
    console.error("Moderate-text error:", error);
    return NextResponse.json(
      { ok: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
