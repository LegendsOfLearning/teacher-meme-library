import { NextResponse } from "next/server";
import { getFormatById } from "../../lib/meme-formats";
import { getGalleryItemByFile } from "../../lib/gallery";
import { renderGalleryMeme } from "../../lib/gallery-meme";
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
    // Trim + keep known zone keys. Empty strings are allowed for optional
    // panels (e.g. Anakin p3) — validation only requires one non-empty zone.
    const cleanCaptions = {};
    for (const z of format.zones) {
      if (z.decorative) continue;
      const v = captions[z.key];
      if (typeof v === "string") cleanCaptions[z.key] = v.trim();
    }
    // Also accept gallery caption keys that match zones (defensive).
    for (const [key, value] of Object.entries(captions)) {
      if (typeof value !== "string") continue;
      if (cleanCaptions[key] !== undefined) continue;
      const zone = format.zones.find((z) => z.key === key && !z.decorative);
      if (zone) cleanCaptions[key] = value.trim();
    }

    const safe = await validateUserCaptions(format, cleanCaptions);
    if (!safe.ok) {
      return NextResponse.json(
        { error: safe.message, code: safe.reason },
        { status: 400 }
      );
    }

    if (galleryFile) {
      const galleryItem = getGalleryItemByFile(galleryFile);
      if (!galleryItem) {
        return NextResponse.json(
          { error: "That gallery meme could not be found." },
          { status: 400 }
        );
      }
      if (galleryItem.remixFormatId !== formatId) {
        return NextResponse.json(
          { error: "Gallery meme and format do not match." },
          { status: 400 }
        );
      }

      const record = await generateMeme({
        situationId: situationId || "lesson-planning",
        toneId: toneId || "relatable",
        formatId,
        userCaptions: cleanCaptions,
        galleryItem,
      });
      return NextResponse.json(record);
    }

    const record = await generateMeme({
      situationId: situationId || "lesson-planning",
      toneId: toneId || "relatable",
      formatId,
      userCaptions: cleanCaptions,
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
