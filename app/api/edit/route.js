import { NextResponse } from "next/server";
import { getFormatById } from "../../lib/meme-formats";
import {
  generateMeme,
  validateUserCaptions,
} from "../../lib/workflow";

// Edit / Manual mode endpoint.
// Accepts a format ID + a captions map keyed by zone, validates safety,
// then renders + saves the meme through the same persistence layer
// the agentic workflow uses (so /meme/<id> still works).

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { formatId, captions, situationId, toneId, galleryFile } = body || {};

    const format = getFormatById(formatId);
    if (!format) {
      return NextResponse.json(
        { error: "Pick a meme format to edit." },
        { status: 400 }
      );
    }
    if (!captions || typeof captions !== "object") {
      return NextResponse.json(
        { error: "Provide captions for each zone." },
        { status: 400 }
      );
    }
    // Trim + restrict to known zones — discard anything else the
    // client tried to sneak in.
    const cleanCaptions = {};
    for (const z of format.zones) {
      const v = captions[z.key];
      if (typeof v === "string") cleanCaptions[z.key] = v.trim();
    }

    const safe = await validateUserCaptions(format, cleanCaptions);
    if (!safe.ok) {
      return NextResponse.json(
        { error: safe.message, code: safe.reason },
        { status: 400 }
      );
    }

    const record = await generateMeme({
      situationId: situationId || "lesson-planning",
      toneId: toneId || "relatable",
      formatId,
      userCaptions: cleanCaptions,
      sourceFile: galleryFile || null,
    });

    return NextResponse.json(record);
  } catch (e) {
    console.error("Meme edit error:", e);
    const status = e.code === "ADVERSARIAL_VETO" ? 422 : 500;
    return NextResponse.json(
      { error: e.message || "Internal error", code: e.code || null },
      { status }
    );
  }
}
